/**
 * Shared layout primitives for the multi-track recording editor.
 *
 * <TrackRow>     — one row per track: fixed-width label column on the left,
 *                  flexible timeline column on the right. All track rows
 *                  align vertically by sharing the same label column width.
 *
 * <TimelineRuler>— horizontal time axis rendered once above the stack of
 *                  TrackRows. Tick marks every 1s; numeric labels at a
 *                  density tuned to pixelsPerSec.
 *
 * pixelsPerSec + timelineSpan are computed by the parent (Recorder) so
 * every track shares one time scale and clips line up across rows.
 */

'use client';

import { ReactNode } from 'react';

export const TRACK_LABEL_WIDTH = 140;
const RULER_HEIGHT = 22;

interface TrackRowProps {
  /** Small uppercase eyebrow label rendered in the left column. */
  label: string;
  /** Optional secondary text below the label (e.g. "0:03" or "2 layered"). */
  sublabel?: string;
  /** Optional action(s) — typically a single small button like "+ Add". */
  action?: ReactNode;
  /** The timeline content (waveform, SFX lane, etc.) for this track. */
  children: ReactNode;
}

export function TrackRow({ label, sublabel, action, children }: TrackRowProps) {
  return (
    <div className="flex items-stretch border-b border-gray-100 last:border-b-0 py-3">
      <div
        className="flex flex-col justify-center pr-3"
        style={{ width: TRACK_LABEL_WIDTH, flexShrink: 0 }}
      >
        <span className="text-[10px] font-bold tracking-wider text-gray-700 uppercase">{label}</span>
        {sublabel && <span className="text-xs text-gray-500 mt-0.5">{sublabel}</span>}
        {action && <div className="mt-2">{action}</div>}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

interface TimelineRulerProps {
  pixelsPerSec: number;
  timelineSpan: number;
}

export function TimelineRuler({ pixelsPerSec, timelineSpan }: TimelineRulerProps) {
  // Density-driven label spacing: tighter scales get every-second labels,
  // wider scales space them out so the ruler stays legible.
  const labelEverySec = pixelsPerSec >= 60 ? 1 : pixelsPerSec >= 30 ? 2 : 5;
  const ticks: number[] = [];
  for (let s = 0; s <= timelineSpan; s += 1) ticks.push(s);
  const width = timelineSpan * pixelsPerSec;

  return (
    <div className="flex items-end" aria-hidden>
      <div style={{ width: TRACK_LABEL_WIDTH, flexShrink: 0 }} />
      <div
        className="relative border-b border-gray-300"
        style={{ width, height: RULER_HEIGHT }}
      >
        {ticks.map((s) => {
          const isLabeled = s % labelEverySec === 0;
          return (
            <div
              key={s}
              className="absolute bottom-0"
              style={{ left: `${s * pixelsPerSec}px`, top: 0 }}
            >
              <div className={`w-px ${isLabeled ? 'h-3 bg-gray-400' : 'h-1.5 bg-gray-300'} ml-0`} />
              {isLabeled && s > 0 && (
                <span
                  className="absolute -translate-x-1/2 text-[10px] text-gray-500"
                  style={{ top: '4px' }}
                >
                  {s}s
                </span>
              )}
            </div>
          );
        })}
        <span className="absolute left-0 text-[10px] text-gray-500" style={{ top: '4px' }}>0s</span>
      </div>
    </div>
  );
}
