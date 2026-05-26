/**
 * Time-axis math for segmented vocal playback.
 *
 * Vocabulary:
 *   - "original time"  — seconds into the raw vocal source file (0 = file 0:00).
 *   - "mix time"       — seconds into the rendered composition (0 = first
 *                        segment plays, cuts are collapsed). This is what
 *                        the playhead reports.
 *
 * When the vocal has a single full segment, mix time == original time minus
 * the segment's startSec — same as the legacy trim model. With multiple
 * segments, mix time skips across gaps: any original-time point that falls
 * in a "cut" (between two segments) has no mix-time mapping at all, while
 * mix-time always maps back to some segment.
 */

import type { VocalSegment } from './layers.types';

export interface MixTimeMapping {
  segIdx: number;
  /** Position inside that segment, in original time. */
  origSec: number;
}

/** Total mix-time duration = sum of segment durations. Pass an empty list
 *  and you get 0, which is also the right answer (no audio to play). */
export function totalMixDuration(segments: VocalSegment[]): number {
  let total = 0;
  for (const s of segments) total += Math.max(0, s.endSec - s.startSec);
  return total;
}

/** Convert a mix-time position to (segment index, position-within-segment
 *  in original time). Returns null only if mixSec < 0 or beyond the end of
 *  the last segment. Boundary point (exactly at a segment's end) maps to
 *  that segment's last instant, not the next segment's start — matches
 *  how playheads stop at the end of a track. */
export function mixTimeToOriginal(
  mixSec: number,
  segments: VocalSegment[],
): MixTimeMapping | null {
  if (mixSec < 0) return null;
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const segDur = Math.max(0, segments[i].endSec - segments[i].startSec);
    if (mixSec < acc + segDur || (i === segments.length - 1 && mixSec <= acc + segDur)) {
      return { segIdx: i, origSec: segments[i].startSec + (mixSec - acc) };
    }
    acc += segDur;
  }
  return null;
}

/** Convert an original-time position to mix-time. Returns null if the
 *  point falls in a cut (between segments). Boundary point (exactly at a
 *  segment edge) maps to the closer segment. */
export function originalToMixTime(
  origSec: number,
  segments: VocalSegment[],
): number | null {
  let acc = 0;
  for (const s of segments) {
    if (origSec >= s.startSec && origSec <= s.endSec) {
      return acc + (origSec - s.startSec);
    }
    acc += Math.max(0, s.endSec - s.startSec);
  }
  return null;
}

/** Split a segments list at the given mix-time position. Returns a new
 *  list where one segment has been cut in two; the other segments are
 *  untouched. Returns null if the position is at a segment boundary
 *  (no-op split) or outside any segment. */
export function splitSegmentsAtMixTime(
  mixSec: number,
  segments: VocalSegment[],
  /** Snap to this many decimal places to avoid sub-millisecond drift. */
  precision = 3,
): VocalSegment[] | null {
  const mapping = mixTimeToOriginal(mixSec, segments);
  if (!mapping) return null;
  const target = segments[mapping.segIdx];
  const splitPoint = Number(mapping.origSec.toFixed(precision));
  // Reject boundary splits — there's nothing to split if the cut sits
  // exactly on the start or end of the segment.
  if (splitPoint <= target.startSec || splitPoint >= target.endSec) return null;
  const left: VocalSegment = { startSec: target.startSec, endSec: splitPoint };
  const right: VocalSegment = { startSec: splitPoint, endSec: target.endSec };
  return [
    ...segments.slice(0, mapping.segIdx),
    left,
    right,
    ...segments.slice(mapping.segIdx + 1),
  ];
}
