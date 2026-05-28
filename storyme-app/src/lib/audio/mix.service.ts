/**
 * Mix service — given an AudioLayers spec, produces a single rendered MP3.
 *
 * Pure function in spirit: input layers → output buffer. No DB writes, no
 * storage uploads — callers handle persistence. Layers reference remote
 * audio URLs (vocal upload, SFX library, ElevenLabs cache); we fetch each
 * to a temp file, build an FFmpeg filter graph, run, and read the result.
 *
 * Pipeline per stream:
 *   - vocal: atrim (if trim) → volume
 *   - music: adelay (startSec) → atrim (clamp to durationSec) → volume
 *   - effect: adelay (startSec) → atrim (clamp to durationSec) → volume
 *   - amix all → out
 *
 * Phase 2b ships without sidechain ducking — default music volume (-18 dB)
 * keeps vocals intelligible. Ducking can drop in later as a filter swap
 * without touching the layer schema.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { AudioLayers, DEFAULT_VOLUMES, normalizeVocalSegments } from './layers.types';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface PreparedInput {
  path: string;
  /** FFmpeg input index (-i N). */
  index: number;
}

async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = join(tmpdir(), `mix-${tempId}-${suffix}.mp3`);
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err: any) {
    // undici's bare "fetch failed" loses the URL context — surface it so
    // the render endpoint's error message points at the culprit layer.
    throw new Error(`Fetch failed for ${suffix} (${url}): ${err.message || err}`);
  }
  if (!res.ok) throw new Error(`Failed to fetch ${suffix} (${url}): HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buffer);
  return path;
}

/** Vocal filter chain. With one segment that spans the whole source, this
 *  collapses to a single volume tweak (no atrim). With one trimmed segment,
 *  it's atrim+volume. With multiple segments, each gets its own atrim and
 *  they're concat'd in order so cuts (gaps between segments) drop out of
 *  playback. Returns an array of `filterChain` strings — multiple are
 *  needed because each [0:a]atrim creates its own labeled output before
 *  the final concat. */
function vocalFilters(outLabel: string, layer: AudioLayers['vocal']): string[] {
  const segments = normalizeVocalSegments(layer);
  const volDb = layer.volumeDb ?? DEFAULT_VOLUMES.vocal;
  const isWholeFile = segments.length === 1
    && segments[0].startSec === 0
    && segments[0].endSec === layer.durationSec;

  // Fast path: no cuts, no trim → just a volume node (or nothing if 0 dB).
  if (isWholeFile) {
    return [`[0:a]volume=${volDb}dB[${outLabel}]`];
  }

  // Single segment with a real trim — one atrim node + volume.
  if (segments.length === 1) {
    const s = segments[0];
    return [`[0:a]atrim=start=${s.startSec}:end=${s.endSec},asetpts=PTS-STARTPTS,volume=${volDb}dB[${outLabel}]`];
  }

  // Multi-segment: N atrim chains + a concat at the end. We label each
  // intermediate as v_seg_<idx>, then concat into outLabel with the
  // volume tweak applied after concat (cheaper than once per segment).
  const filters: string[] = [];
  const segLabels: string[] = [];
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    const label = `v_seg_${i}`;
    segLabels.push(label);
    filters.push(`[0:a]atrim=start=${s.startSec}:end=${s.endSec},asetpts=PTS-STARTPTS[${label}]`);
  }
  const concatInputs = segLabels.map((l) => `[${l}]`).join('');
  filters.push(`${concatInputs}concat=n=${segments.length}:v=0:a=1[v_concat]`);
  filters.push(`[v_concat]volume=${volDb}dB[${outLabel}]`);
  return filters;
}

function timedLayerFilter(
  inputIdx: number,
  label: string,
  startSec: number,
  durationSec: number,
  volumeDb: number,
  sourceOffsetSec: number = 0,
): string {
  const delayMs = Math.round(startSec * 1000);
  // sourceOffsetSec > 0: skip the source's first N seconds via an inner
  //   atrim+asetpts, THEN delay, THEN clamp the audible length.
  // sourceOffsetSec = 0 (the common case): just delay + clamp.
  const sourceSlice = sourceOffsetSec > 0
    ? `atrim=start=${sourceOffsetSec},asetpts=PTS-STARTPTS,`
    : '';
  // adelay with per-channel values (no `:all=1` — that keyword needs
  // FFmpeg 4.4+, but Vercel's @ffmpeg-installer/ffmpeg ships 4.2.x).
  // Providing the same delay 4 times covers up to quadraphonic; extra
  // values are silently ignored on stereo/mono inputs.
  const channelDelays = `${delayMs}|${delayMs}|${delayMs}|${delayMs}`;
  return `[${inputIdx}:a]${sourceSlice}adelay=${channelDelays},atrim=duration=${startSec + durationSec},volume=${volumeDb}dB[${label}]`;
}

/** Sanitize a string for use as a `[label]` inside an FFmpeg filter graph.
 *  Hyphens (in our UUIDs) confuse older FFmpeg parsers; underscore-only
 *  identifiers are universally safe. */
function safeLabel(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '_');
}

export async function mixLayersToMp3(layers: AudioLayers): Promise<Buffer> {
  const tempPaths: string[] = [];
  const outputPath = join(tmpdir(), `mix-out-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp3`);

  try {
    // Download vocal first (input 0).
    const vocalPath = await downloadToTemp(layers.vocal.url, 'vocal');
    tempPaths.push(vocalPath);

    const inputs: PreparedInput[] = [{ path: vocalPath, index: 0 }];

    // Download music + effects sequentially. Could parallelize for speed,
    // but serial is simpler and the typical page has <5 layers.
    for (const m of layers.music) {
      const path = await downloadToTemp(m.url, `music-${m.id}`);
      tempPaths.push(path);
      inputs.push({ path, index: inputs.length });
    }
    for (const e of layers.effects) {
      const path = await downloadToTemp(e.url, `effect-${e.id}`);
      tempPaths.push(path);
      inputs.push({ path, index: inputs.length });
    }

    // Build filter_complex graph. vocalFilters returns 1+ chain strings
    // because multi-segment vocals need per-segment atrim + concat.
    const filters: string[] = [...vocalFilters('vocal_out', layers.vocal)];
    const mixInputs: string[] = ['[vocal_out]'];

    let musicCursor = 1;
    for (const m of layers.music) {
      const label = safeLabel(`music_${m.id}_out`);
      filters.push(
        timedLayerFilter(musicCursor, label, m.startSec, m.durationSec, m.volumeDb ?? DEFAULT_VOLUMES.music),
      );
      mixInputs.push(`[${label}]`);
      musicCursor++;
    }
    let effectCursor = musicCursor;
    for (const e of layers.effects) {
      const label = safeLabel(`effect_${e.id}_out`);
      filters.push(
        timedLayerFilter(
          effectCursor,
          label,
          e.startSec,
          e.durationSec,
          e.volumeDb ?? DEFAULT_VOLUMES.effect,
          e.sourceOffsetSec ?? 0,
        ),
      );
      mixInputs.push(`[${label}]`);
      effectCursor++;
    }

    // amix all streams. We'd love `normalize=0` (keeps per-stream volumes
    // as authored), but that option needs FFmpeg 4.4+ and Vercel ships
    // 4.2.x. Without it, amix auto-attenuates by 1/N so the mix gets a
    // touch quieter as layers add. We pre-bake compensating gain into
    // each layer's volume to undo the attenuation.
    // Cap the compensation at +12 dB. amix's 1/N attenuation scales
    // logarithmically (+6 dB per doubling of layer count), so by ~8 layers
    // the math says we'd boost +18 dB to compensate — enough to clip
    // confidently if individual layer levels are already calibrated for
    // a single-layer mix. +12 dB is the headroom budget that keeps a
    // realistic page (vocal + 3 SFX + 3 music) audible without clipping.
    const rawCompensateDb = 20 * Math.log10(mixInputs.length);
    const compensateDb = Math.min(rawCompensateDb, 12);
    filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest[mixed_raw];[mixed_raw]volume=${compensateDb.toFixed(2)}dB[mixed]`);

    // Fast path: vocal-only AND no edits whatsoever — just stream-copy
    // the input MP3. Avoids re-encoding entirely. "No edits" means: zero
    // music, zero effects, no volume tweak, and a single segment that
    // covers the entire source (i.e., the user neither trimmed nor split).
    const vocalSegments = normalizeVocalSegments(layers.vocal);
    const wholeFile =
      vocalSegments.length === 1
      && vocalSegments[0].startSec === 0
      && vocalSegments[0].endSec === layers.vocal.durationSec;
    const vocalIsUntouched =
      layers.music.length === 0
      && layers.effects.length === 0
      && wholeFile
      && (layers.vocal.volumeDb === undefined || layers.vocal.volumeDb === 0);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      for (const input of inputs) cmd.input(input.path);
      if (vocalIsUntouched) {
        cmd.audioCodec('copy');
      } else {
        cmd
          .complexFilter(filters, ['mixed'])
          .audioCodec('libmp3lame')
          .audioBitrate('128k');
      }
      cmd
        .format('mp3')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath);
    });

    const out = await readFile(outputPath);
    return out;
  } finally {
    for (const p of tempPaths) {
      try { await unlink(p); } catch { /* ignore */ }
    }
    try { await unlink(outputPath); } catch { /* ignore */ }
  }
}
