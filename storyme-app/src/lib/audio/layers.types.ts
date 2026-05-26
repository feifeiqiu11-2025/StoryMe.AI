/**
 * Shared TypeScript shapes for the layered-audio system. Mirrors the JSONB
 * stored in story_audio_pages.audio_layers — must stay in sync with the
 * comment on that column in 20260525_add_audio_layers_and_sfx_library.sql.
 *
 * The `version` field is intentional: future shape changes (effects with
 * fade-in, music with crossfade, anchors to text offsets for re-narration
 * robustness) bump the version and the mix service branches on it.
 */

import { z } from 'zod';

/** One playable window into the vocal source. Multiple segments per vocal
 *  layer = the user split-and-trimmed the recording (cut out a stutter,
 *  removed silence, etc.); the mix concatenates them back-to-back. */
export const VocalSegmentSchema = z.object({
  startSec: z.number().min(0),
  endSec: z.number().positive(),
}).refine((s) => s.endSec > s.startSec, {
  message: 'endSec must be greater than startSec',
});

export const VocalLayerSchema = z.object({
  url: z.string().url(),
  durationSec: z.number().positive(),
  /** Legacy fields — kept readable so older audio_layers rows still parse.
      New writes set `segments` instead. The mix + preview pipelines call
      `normalizeVocalSegments` to collapse to a single representation. */
  trimStartSec: z.number().min(0).optional(),
  trimEndSec: z.number().positive().optional(),
  /** Ordered, non-overlapping list of windows played back-to-back. When
      absent, falls back to the trim fields (or whole source if none set). */
  segments: z.array(VocalSegmentSchema).min(1).optional(),
  /** Vocal volume in dB relative to source. Default 0 (no change). */
  volumeDb: z.number().min(-30).max(12).optional(),
});

export const MusicLayerSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  sfxLibraryId: z.string().uuid().optional(),
  startSec: z.number().min(0),
  durationSec: z.number().positive().max(600),
  /** Default -18 dB — background music level. */
  volumeDb: z.number().min(-30).max(6).optional(),
  /** When true, sidechain-duck under vocal so vocal stays intelligible. */
  duckUnderVocal: z.boolean().optional(),
});

export const EffectLayerSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  sfxLibraryId: z.string().uuid().optional(),
  startSec: z.number().min(0),
  durationSec: z.number().positive().max(30),
  /** Offset INTO the source file — lets a clip skip the source's
      beginning. Useful when an effect has dead air at its start. The mix
      filter applies `atrim=start=sourceOffsetSec` before `adelay`. */
  sourceOffsetSec: z.number().min(0).optional(),
  /** Default -6 dB — effects are mid-foreground. */
  volumeDb: z.number().min(-30).max(6).optional(),
});

export const AudioLayersSchema = z.object({
  version: z.literal(1),
  vocal: VocalLayerSchema,
  music: z.array(MusicLayerSchema).max(4).default([]),
  effects: z.array(EffectLayerSchema).max(20).default([]),
});

export type VocalSegment = z.infer<typeof VocalSegmentSchema>;
export type VocalLayer = z.infer<typeof VocalLayerSchema>;
export type MusicLayer = z.infer<typeof MusicLayerSchema>;
export type EffectLayer = z.infer<typeof EffectLayerSchema>;
export type AudioLayers = z.infer<typeof AudioLayersSchema>;

/** Collapse a VocalLayer to its canonical segments list, synthesizing from
 *  the legacy trim fields when `segments` is absent. Always returns at
 *  least one segment. Mix + preview pipelines call this so they only have
 *  one shape to reason about. */
export function normalizeVocalSegments(v: VocalLayer): VocalSegment[] {
  if (v.segments && v.segments.length > 0) return v.segments;
  const startSec = v.trimStartSec ?? 0;
  const endSec = v.trimEndSec ?? v.durationSec;
  return [{ startSec, endSec }];
}

/** Default volumes the mix service uses when a layer omits `volumeDb`. */
export const DEFAULT_VOLUMES = {
  vocal: 0,
  music: -18,
  effect: -6,
} as const;
