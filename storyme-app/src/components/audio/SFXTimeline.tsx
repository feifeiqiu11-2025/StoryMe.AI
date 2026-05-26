/**
 * SFXTimeline — horizontal time-axis lane with draggable clip blocks for
 * sound effects, in the spirit of CapCut / Premiere's timeline. Replaces
 * the number-input rows (Start: X, Vol: Y) with direct manipulation.
 *
 * Interactions:
 *   - Drag a clip body horizontally → change startSec (when it fires in
 *     the mix). Clamps to [0, maxTimeSec - durationSec].
 *   - Drag the right edge handle → trim durationSec shorter (or extend
 *     back to the source duration). Clamps to [0.1, source.duration_sec].
 *   - Click a clip → select it (host can render volume control below).
 *   - Click the × badge → remove.
 *
 * Out of scope for v1:
 *   - Left-edge trim (would need a source-offset field on PendingEffect
 *     since the mix filter plays the SFX from its 0:00). Worth adding
 *     when we revisit the layer model.
 *   - Multiple stacked SFX lanes. v1 has one lane; clips overlap freely.
 *   - Mobile touch refinements beyond Pointer Events. Should work on
 *     iOS/Android but tuned for desktop pixel drags.
 */

'use client';

import { useCallback, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { PendingEffect } from './Recorder';

interface SFXTimelineProps {
  effects: PendingEffect[];
  /** Pixel-per-second scale shared across tracks. Computed by the host
      (Recorder) from the available timeline column width + the longest
      track's duration, then passed down so every track aligns. */
  pixelsPerSec: number;
  /** Total length of the lane in seconds, used to size the lane width. */
  timelineSpan: number;
  /** Vocal trim start in original-time seconds. Effect `startSec` is in
      mix time (0 = vocal trim start); rendering shifts each clip right
      by this much so visual position matches what plays when mixed. */
  trimStartSec: number;
  selectedEffectId: string | null;
  onSelectEffect: (id: string | null) => void;
  onUpdateEffect: (
    id: string,
    patch: { startSec?: number; durationSec?: number; sourceOffsetSec?: number },
  ) => void;
  onRemoveEffect: (id: string) => void;
  /** Fires when a clip drag begins / ends so the host can freeze
      timelineSpan during the gesture (otherwise the lane keeps rescaling
      under the cursor as longestClipEnd shifts). */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

// Layout constants — kept here so the math reads cleanly.
const LANE_HEIGHT = 56;
const HANDLE_WIDTH = 8;

type DragMode = null | 'move' | 'resize-left' | 'resize-right';

interface DragState {
  effectId: string;
  mode: DragMode;
  pointerStartX: number;
  initialStartSec: number;
  initialDurationSec: number;
  initialSourceOffsetSec: number;
  /** pixelsPerSec captured at drag start. Held constant for the rest of
      the gesture so the lane doesn't rescale under the cursor mid-drag. */
  frozenPixelsPerSec: number;
}

export default function SFXTimeline({
  effects,
  pixelsPerSec,
  timelineSpan,
  trimStartSec,
  selectedEffectId,
  onSelectEffect,
  onUpdateEffect,
  onRemoveEffect,
  onDragStart,
  onDragEnd,
}: SFXTimelineProps) {
  const [drag, setDrag] = useState<DragState | null>(null);

  const secToPx = (sec: number) => sec * pixelsPerSec;
  const pxToSec = (px: number) => px / pixelsPerSec;
  const laneWidth = secToPx(timelineSpan);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, effect: PendingEffect, mode: 'move' | 'resize-left' | 'resize-right') => {
      e.stopPropagation();
      (e.target as Element).setPointerCapture(e.pointerId);
      onSelectEffect(effect.id);
      onDragStart?.();
      setDrag({
        effectId: effect.id,
        mode,
        pointerStartX: e.clientX,
        initialStartSec: effect.startSec,
        initialDurationSec: effect.durationSec,
        initialSourceOffsetSec: effect.sourceOffsetSec ?? 0,
        frozenPixelsPerSec: pixelsPerSec,
      });
    },
    [onSelectEffect, pixelsPerSec],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const effect = effects.find((x) => x.id === drag.effectId);
      if (!effect) return;
      const deltaPx = e.clientX - drag.pointerStartX;
      // Use the pixelsPerSec captured at drag start so a mid-drag rescale
      // (caused by the timeline extending under another clip) doesn't
      // accelerate the cursor's effect on this clip.
      const deltaSec = deltaPx / drag.frozenPixelsPerSec;
      const snap = (sec: number) => Math.round(sec * 10) / 10;

      if (drag.mode === 'move') {
        const newStart = Math.max(0, drag.initialStartSec + deltaSec);
        onUpdateEffect(drag.effectId, { startSec: snap(newStart) });
      } else if (drag.mode === 'resize-right') {
        // Right edge can't extend past what's left in the source after the
        // left-edge offset; can't be shorter than 0.1s.
        const sourceMax = effect.sound.duration_sec - (drag.initialSourceOffsetSec);
        const newDuration = Math.max(
          0.1,
          Math.min(sourceMax, drag.initialDurationSec + deltaSec),
        );
        onUpdateEffect(drag.effectId, { durationSec: snap(newDuration) });
      } else if (drag.mode === 'resize-left') {
        // Left edge moves both startSec and sourceOffsetSec by the same
        // delta, while durationSec changes by -delta so the right edge
        // stays anchored. Bounds: startSec >= 0, sourceOffsetSec >= 0,
        // durationSec >= 0.1.
        const maxRight = drag.initialDurationSec - 0.1;            // can shrink up to 0.1s left
        const maxLeft = Math.min(drag.initialStartSec, drag.initialSourceOffsetSec); // can grow until either bound hits 0
        const clampedDelta = Math.max(-maxLeft, Math.min(maxRight, deltaSec));
        onUpdateEffect(drag.effectId, {
          startSec: snap(drag.initialStartSec + clampedDelta),
          sourceOffsetSec: snap(drag.initialSourceOffsetSec + clampedDelta),
          durationSec: snap(drag.initialDurationSec - clampedDelta),
        });
      }
    },
    [drag, effects, pxToSec, onUpdateEffect],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (drag) {
      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      setDrag(null);
      onDragEnd?.();
    }
  }, [drag, onDragEnd]);

  const handleLaneClick = (e: React.MouseEvent) => {
    // Click on empty lane background deselects.
    if (e.target === e.currentTarget) onSelectEffect(null);
  };

  return (
    <div className="select-none" style={{ width: laneWidth }}>
      {/* SFX lane — relative box; clips are absolutely positioned. The
          ruler is rendered by the host TimelineRuler so all tracks share one. */}
      <div
        onMouseDown={handleLaneClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative"
        style={{ height: LANE_HEIGHT, width: laneWidth }}
      >
        {effects.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xs text-gray-400">Drop a sound from the picker — drag the clip to position it</span>
          </div>
        ) : (
          effects.map((eff) => {
            const isSelected = eff.id === selectedEffectId;
            // Clip's visual position = trim-start in original-time PLUS
            // its startSec (which is in mix-time from the vocal trim start).
            // That makes the clip block line up visually with the moment
            // in the trimmed vocal where it'll actually fire.
            const leftPx = secToPx(trimStartSec + eff.startSec);
            const widthPx = Math.max(20, secToPx(eff.durationSec));
            return (
              <div
                key={eff.id}
                onPointerDown={(e) => handlePointerDown(e, eff, 'move')}
                onClick={(e) => { e.stopPropagation(); onSelectEffect(eff.id); }}
                role="button"
                aria-label={`${eff.sound.name}, starts at ${eff.startSec.toFixed(1)} seconds, ${eff.durationSec.toFixed(1)} seconds long`}
                aria-pressed={isSelected}
                className={`absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing transition-shadow overflow-hidden z-[15] ${
                  isSelected
                    ? 'bg-orange-50 ring-1 ring-orange-500 shadow-sm'
                    : 'bg-orange-50 ring-1 ring-orange-300 hover:ring-orange-400'
                }`}
                style={{ left: `${leftPx}px`, width: `${widthPx}px` }}
              >
                {/* Darker top accent gives the clip a DAW-style header
                    without the loud solid-fill look. Stripe gets stronger
                    on selection. */}
                <div className={`h-1 ${isSelected ? 'bg-orange-500' : 'bg-orange-400'}`} />
                <div className="flex items-center justify-between gap-1 h-[calc(100%-4px)] text-orange-900" style={{ paddingLeft: HANDLE_WIDTH + 4, paddingRight: HANDLE_WIDTH + 4 }}>
                  <span className="text-[11px] font-medium truncate flex-1" title={eff.sound.name}>
                    {eff.sound.name}
                  </span>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); onRemoveEffect(eff.id); }}
                    aria-label={`Remove ${eff.sound.name}`}
                    className="flex-shrink-0 p-0.5 rounded text-orange-700 hover:text-orange-900 hover:bg-orange-100 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                {/* Edge resize handles — always visible as thin gripper
                    bars on both sides so users see they can drag either
                    edge. Selected state darkens the bar; hover brightens. */}
                <div
                  onPointerDown={(e) => handlePointerDown(e, eff, 'resize-left')}
                  className={`absolute top-0 left-0 bottom-0 cursor-ew-resize ${
                    isSelected ? 'bg-orange-500/50' : 'bg-orange-400/25 hover:bg-orange-500/50'
                  } transition-colors`}
                  style={{ width: HANDLE_WIDTH }}
                  aria-label="Resize start"
                />
                <div
                  onPointerDown={(e) => handlePointerDown(e, eff, 'resize-right')}
                  className={`absolute top-0 right-0 bottom-0 cursor-ew-resize ${
                    isSelected ? 'bg-orange-500/50' : 'bg-orange-400/25 hover:bg-orange-500/50'
                  } transition-colors`}
                  style={{ width: HANDLE_WIDTH }}
                  aria-label="Resize end"
                />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
