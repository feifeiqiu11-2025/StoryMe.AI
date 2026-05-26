/**
 * WaveformTrimmer — visual waveform editor for trimming a recorded audio blob.
 *
 * Wraps WaveSurfer.js v7 + Regions plugin. Renders the waveform, places a
 * single draggable/resizable region representing the trim window, and emits
 * the current [startSec, endSec] range to the host on every change.
 *
 * Controlled mode (Phase 2b Step B): when `widthPx` is provided, the
 * waveform renders at exactly that width so it aligns with adjacent timeline
 * tracks at the same pixelsPerSec scale. Play controls (Full / Trimmed) are
 * lifted to the host via an imperative ref; the trimmer no longer renders
 * its own button row when `controlled` is true.
 */

'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

export interface TrimRange {
  startSec: number;
  endSec: number;
}

export interface WaveformTrimmerHandle {
  /** Play the current trim region (which is the full audio when no trim
      handles have been dragged in from the edges). Matches the CapCut
      mental model: what you see selected IS what plays. */
  play: () => void;
  stop: () => void;
  /** Current trim range — reads from the WaveSurfer region instance. */
  getTrim: () => TrimRange | null;
}

interface WaveformTrimmerProps {
  audioBlob: Blob;
  /** Initial trim range; defaults to [0, fullDuration]. */
  initialTrim?: TrimRange;
  onTrimChange?: (range: TrimRange) => void;
  /** Reset signal — incrementing this prop snaps the region back to full range. */
  resetSignal?: number;
  /** When set, the waveform container is forced to this pixel width so it
      aligns with other tracks on a shared time axis. When omitted, the
      waveform fills its container. */
  widthPx?: number;
  /** Notify host of playback state changes so a lifted play button can
      render its current label (Play vs Stop). */
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const WaveformTrimmer = forwardRef<WaveformTrimmerHandle, WaveformTrimmerProps>(function WaveformTrimmer(
  { audioBlob, initialTrim, onTrimChange, resetSignal, widthPx, onPlayStateChange },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const regionRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Init WaveSurfer once per blob.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let url: string | null = null;
    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { default: WaveSurfer } = await import('wavesurfer.js');
        const { default: RegionsPlugin } = await import('wavesurfer.js/dist/plugins/regions.esm.js');
        if (cancelled || !containerRef.current) return;

        url = URL.createObjectURL(audioBlob);
        const ws = WaveSurfer.create({
          container: containerRef.current,
          waveColor: '#a78bfa',
          progressColor: '#7c3aed',
          // No WaveSurfer cursor — the global red playhead drives all
          // visual playback state; this internal one would just be a
          // second cursor leftover from where the user last clicked.
          cursorWidth: 0,
          height: 64,
          barWidth: 2,
          barGap: 1,
          barRadius: 2,
        });
        const regions = ws.registerPlugin(RegionsPlugin.create());
        wsRef.current = ws;

        ws.on('ready', () => {
          const dur = ws.getDuration();
          const start = initialTrim?.startSec ?? 0;
          const end = initialTrim?.endSec ?? dur;
          const region = regions.addRegion({
            start: Math.max(0, Math.min(start, dur)),
            end: Math.max(0, Math.min(end, dur)),
            drag: true,
            resize: true,
            color: 'rgba(124, 58, 237, 0.18)',
          });
          regionRef.current = region;
          region.on('update', () => {
            onTrimChange?.({ startSec: region.start, endSec: region.end });
          });
        });

        ws.on('play', () => onPlayStateChange?.(true));
        ws.on('pause', () => onPlayStateChange?.(false));
        ws.on('finish', () => onPlayStateChange?.(false));

        await ws.load(url);

        cleanup = () => {
          ws.destroy();
          if (url) URL.revokeObjectURL(url);
        };
      } catch (err: any) {
        if (!cancelled) {
          console.error('WaveformTrimmer init failed:', err);
          setError(err.message || 'Could not load waveform');
        }
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      wsRef.current = null;
      regionRef.current = null;
    };
  }, [audioBlob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset signal — snap region back to full range.
  useEffect(() => {
    if (resetSignal === undefined) return;
    const ws = wsRef.current;
    const region = regionRef.current;
    if (!ws || !region) return;
    const dur = ws.getDuration();
    region.setOptions({ start: 0, end: dur });
    onTrimChange?.({ startSec: 0, endSec: dur });
  }, [resetSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  useImperativeHandle(ref, () => ({
    play: () => {
      const ws = wsRef.current;
      const region = regionRef.current;
      if (!ws) return;
      if (region && typeof region.play === 'function') {
        region.play();
      } else if (region) {
        ws.setTime(region.start);
        ws.play();
      } else {
        ws.setTime(0);
        ws.play();
      }
    },
    stop: () => wsRef.current?.pause(),
    getTrim: () => {
      const region = regionRef.current;
      if (!region) return null;
      return { startSec: region.start, endSec: region.end };
    },
  }), []);

  if (error) {
    return (
      <div role="alert" className="p-4 bg-red-50 text-red-700 text-sm rounded-lg">
        Waveform failed to load: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-white border border-gray-200 rounded-md p-1"
      style={widthPx ? { width: widthPx } : undefined}
      aria-label="Voice waveform with trim region"
    />
  );
});

export default WaveformTrimmer;
