/**
 * Web Audio in-browser mix preview.
 *
 * Plays the user's vocal recording layered with the current SFX placements
 * BEFORE Save & Continue burns the server-side FFmpeg render. Mirrors the
 * mix.service pipeline at parity:
 *   - vocal trim window respected via AudioBufferSourceNode start(when, offset, dur)
 *   - each effect: sourceOffsetSec → offset arg; startSec → when arg; durationSec → dur arg
 *   - per-layer volume via GainNode set to volumeDb
 *   - amix-equivalent via the master GainNode (normalize=0 — no auto-attenuation)
 *
 * Usage:
 *   const player = await createMixPlayer({ vocalBlob, trimRange, effects, defaults });
 *   player.onProgress((sec, totalSec) => setPlayhead(sec));
 *   player.onEnded(() => setPlaying(false));
 *   player.play();         // resumes from current playhead OR 0 if first call / past end
 *   player.stop();
 *   player.dispose();      // releases AudioContext + listeners
 *
 * Caveats:
 *   - iOS Safari requires the first AudioContext to be unlocked via a user
 *     gesture. Calling `play()` synchronously from a click handler satisfies
 *     this; auto-play on mount would not.
 *   - SFX URLs must be fetchable from this origin (the SFX library serves
 *     CORS-friendly Supabase Storage URLs, so this is fine in practice).
 *   - We decode each clip once on create. If layers change, create a new
 *     player — they're cheap to dispose and rebuild.
 */

export interface PreviewEffect {
  id: string;
  url: string;
  startSec: number;
  durationSec: number;
  sourceOffsetSec: number;
  volumeDb: number;
}

export interface VocalSegmentSpec {
  startSec: number;
  endSec: number;
}

export interface PreviewMixParams {
  vocalBlob: Blob;
  /** Ordered, non-overlapping vocal windows played back-to-back. When
      undefined or empty, the whole vocal plays as one segment. The
      `trimRange` field below stays accepted for callers that haven't
      migrated; pass one OR the other, not both. */
  segments?: VocalSegmentSpec[];
  /** Legacy single-window form. Equivalent to segments=[{ start, end }]. */
  trimRange?: { startSec: number; endSec: number };
  /** Vocal level in dB. Default 0. */
  vocalVolumeDb?: number;
  effects: PreviewEffect[];
}

export interface MixPlayer {
  play(): void;
  stop(): void;
  /** Jump to a position in the composition. If playing, restarts from
      `sec`. If paused, sets the position so the next `play()` resumes
      there. Bounded to [0, durationSec]. */
  seek(sec: number): void;
  /** Total composition duration in seconds — max of trimmed vocal and any
      effect's end position. */
  durationSec: number;
  onProgress(cb: (currentSec: number, totalSec: number) => void): void;
  onEnded(cb: () => void): void;
  dispose(): void;
}

function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export async function createMixPlayer(params: PreviewMixParams): Promise<MixPlayer> {
  // Browser-only API; throw a useful error if someone calls this in SSR.
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
    throw new Error('createMixPlayer requires a browser AudioContext');
  }
  const ctx = new AudioContext();

  // Decode vocal blob.
  const vocalArrayBuffer = await params.vocalBlob.arrayBuffer();
  const vocalBuffer = await ctx.decodeAudioData(vocalArrayBuffer.slice(0));

  // Decode every effect URL in parallel. Failures don't kill the whole
  // player — we skip that effect and log; the user still hears vocal +
  // the rest of the SFX.
  const effectDecodes = await Promise.all(
    params.effects.map(async (eff) => {
      try {
        const res = await fetch(eff.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(buf.slice(0));
        return { eff, buffer: decoded as AudioBuffer | null };
      } catch (err) {
        console.warn(`Preview: failed to load effect ${eff.id} (${eff.url}):`, err);
        return { eff, buffer: null };
      }
    }),
  );

  // Resolve segments — explicit list wins, fall back to legacy trimRange,
  // fall back to "whole buffer". Each segment plays back-to-back; gaps
  // between adjacent segments in original-time drop out of playback.
  const segments: VocalSegmentSpec[] = (() => {
    if (params.segments && params.segments.length > 0) return params.segments;
    if (params.trimRange) return [params.trimRange];
    return [{ startSec: 0, endSec: vocalBuffer.duration }];
  })();
  // Mix-time offsets — each segment starts at the cumulative duration of
  // the preceding ones. segmentMixStarts[i] = mix-time of segment i's 0:00.
  const segmentMixStarts: number[] = [];
  let mixCursor = 0;
  for (const s of segments) {
    segmentMixStarts.push(mixCursor);
    mixCursor += Math.max(0, s.endSec - s.startSec);
  }
  const vocalDur = mixCursor;

  const longestEffectEnd = params.effects.reduce(
    (max, e) => Math.max(max, e.startSec + e.durationSec),
    0,
  );
  const durationSec = Math.max(vocalDur, longestEffectEnd);

  // Internal state.
  let sources: AudioBufferSourceNode[] = [];
  let startedAtCtxTime = 0;
  let pausedAtSec = 0;
  let isPlaying = false;
  let progressTimer: ReturnType<typeof setInterval> | null = null;
  let progressCb: ((sec: number, total: number) => void) | null = null;
  let endedCb: (() => void) | null = null;
  let disposed = false;

  const masterGain = ctx.createGain();
  masterGain.gain.value = 1;
  masterGain.connect(ctx.destination);

  function clearSources() {
    for (const s of sources) {
      try { s.stop(); } catch { /* already stopped */ }
      try { s.disconnect(); } catch { /* ignore */ }
    }
    sources = [];
  }

  function scheduleFrom(offsetSec: number) {
    clearSources();
    const startCtxTime = ctx.currentTime + 0.02; // tiny lookahead

    // Vocal — schedule each segment as its own AudioBufferSourceNode, with
    // the in-context "when" picked so that segment N starts exactly when
    // segment N-1 ended (no gap, no overlap). Segments entirely before the
    // current offset are skipped; the segment that contains the offset
    // gets partial scheduling.
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const segDur = Math.max(0, seg.endSec - seg.startSec);
      if (segDur <= 0) continue;
      const segMixStart = segmentMixStarts[i];
      const segMixEnd = segMixStart + segDur;
      if (offsetSec >= segMixEnd) continue;        // already past this segment
      const audibleMixStart = Math.max(segMixStart, offsetSec);
      const intoSegmentSec = audibleMixStart - segMixStart;
      const playDur = segDur - intoSegmentSec;
      const whenInCtx = startCtxTime + (audibleMixStart - offsetSec);
      const src = ctx.createBufferSource();
      src.buffer = vocalBuffer;
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(params.vocalVolumeDb ?? 0);
      src.connect(gain).connect(masterGain);
      src.start(whenInCtx, seg.startSec + intoSegmentSec, playDur);
      sources.push(src);
    }

    // Effects — each scheduled at its startSec on the mix timeline,
    // accounting for the current playhead offset.
    for (const { eff, buffer } of effectDecodes) {
      if (!buffer) continue;
      const effEnd = eff.startSec + eff.durationSec;
      if (offsetSec >= effEnd) continue;       // already past this effect
      const audibleStartInMix = Math.max(eff.startSec, offsetSec);
      const audibleEndInMix = effEnd;
      const playDur = audibleEndInMix - audibleStartInMix;
      if (playDur <= 0.01) continue;
      const sourceOffset = (eff.sourceOffsetSec ?? 0) + (audibleStartInMix - eff.startSec);
      const whenInCtx = startCtxTime + (audibleStartInMix - offsetSec);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = dbToGain(eff.volumeDb);
      src.connect(gain).connect(masterGain);
      // Guard against scheduling past buffer end — clamp playDur.
      const remainingInSource = Math.max(0, buffer.duration - sourceOffset);
      const safeDur = Math.min(playDur, remainingInSource);
      if (safeDur > 0.01) {
        src.start(whenInCtx, sourceOffset, safeDur);
        sources.push(src);
      }
    }

    startedAtCtxTime = startCtxTime - offsetSec;
    isPlaying = true;

    if (progressTimer) clearInterval(progressTimer);
    progressTimer = setInterval(() => {
      if (!isPlaying) return;
      const sec = ctx.currentTime - startedAtCtxTime;
      if (sec >= durationSec) {
        pausedAtSec = 0;
        isPlaying = false;
        if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
        progressCb?.(durationSec, durationSec);
        endedCb?.();
      } else {
        progressCb?.(Math.max(0, sec), durationSec);
      }
    }, 50);
  }

  function play() {
    if (disposed) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const startSec = pausedAtSec >= durationSec ? 0 : pausedAtSec;
    scheduleFrom(startSec);
  }

  function stop() {
    if (disposed) return;
    if (!isPlaying) return;
    const elapsed = ctx.currentTime - startedAtCtxTime;
    pausedAtSec = Math.max(0, Math.min(durationSec, elapsed));
    isPlaying = false;
    clearSources();
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    progressCb?.(pausedAtSec, durationSec);
  }

  function seek(sec: number) {
    if (disposed) return;
    const target = Math.max(0, Math.min(durationSec, sec));
    if (isPlaying) {
      // Re-schedule from the new position. Web Audio doesn't support
      // pausing+offsetting an in-flight buffer source — easiest is to
      // tear down + restart from the target.
      clearSources();
      scheduleFrom(target);
    } else {
      pausedAtSec = target;
      progressCb?.(target, durationSec);
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    clearSources();
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    try { masterGain.disconnect(); } catch { /* ignore */ }
    try { void ctx.close(); } catch { /* ignore */ }
  }

  return {
    play,
    stop,
    seek,
    durationSec,
    onProgress(cb) { progressCb = cb; },
    onEnded(cb) { endedCb = cb; },
    dispose,
  };
}
