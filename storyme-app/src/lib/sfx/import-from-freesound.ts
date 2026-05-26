/**
 * Import a Freesound CC0 sound into our library:
 *   1. Download the HQ MP3 preview (publicly accessible, no OAuth needed)
 *   2. Upload to the `sfx-library` storage bucket at `freesound/<id>.mp3`
 *   3. Upsert a sfx_library row (de-duped on (source='freesound', external_id))
 *
 * Used by both:
 *   - scripts/seed-sfx-library.ts (curated starter pack)
 *   - api/v1/sfx-library/freesound/import (user-driven imports from the picker)
 *
 * Caller must pass a SupabaseClient created with the service role key —
 * RLS blocks writes to sfx_library and the storage bucket for anon roles.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FreesoundSearchResult, attributionFor, getSound } from './freesound-client';

const BUCKET = 'sfx-library';

export interface ImportedSfx {
  id: string;
  name: string;
  tags: string[];
  audio_url: string;
  duration_sec: number;
  source: 'freesound';
  external_id: string;
  attribution: string;
}

interface ImportOptions {
  /** Override the display name (defaults to Freesound's name). Useful for
      the seed script to give cleaner names than "Dog_bark_4.wav". */
  overrideName?: string;
  /** Additional tags merged with Freesound's tags. */
  extraTags?: string[];
  /** Mark this row as a curated starter entry (source='curated' instead of
      'freesound'). Curated rows still have external_id for traceability. */
  asCurated?: boolean;
  /** Library category — sfx (short, default) or music (longer instrumental).
      Drives the Sounds vs Music tab in the recorder browser. Also relaxes
      the duration cap to 180s for music. */
  kind?: 'sfx' | 'music';
}

export async function importFreesoundSound(
  supabase: SupabaseClient,
  freesoundIdOrSound: number | FreesoundSearchResult,
  opts: ImportOptions = {},
): Promise<ImportedSfx> {
  const sound =
    typeof freesoundIdOrSound === 'number'
      ? await getSound(freesoundIdOrSound)
      : freesoundIdOrSound;

  // De-dupe: if we already imported this Freesound ID, return the existing
  // row instead of re-downloading. The unique partial index on
  // (source, external_id) would otherwise reject the insert.
  const existing = await supabase
    .from('sfx_library')
    .select('id, name, tags, audio_url, duration_sec, source, external_id, attribution')
    .eq('source', opts.asCurated ? 'curated' : 'freesound')
    .eq('external_id', String(sound.id))
    .maybeSingle();
  if (existing.data) {
    return existing.data as ImportedSfx;
  }

  // Download the HQ MP3 preview. The preview URLs are stable per sound ID
  // (Freesound doesn't rotate them within a sound's lifetime), but we copy
  // to our bucket anyway so the app doesn't depend on Freesound uptime.
  const previewUrl = sound.previews['preview-hq-mp3'];
  if (!previewUrl) {
    throw new Error(`Freesound sound ${sound.id} has no HQ MP3 preview`);
  }
  const audioRes = await fetch(previewUrl);
  if (!audioRes.ok) {
    throw new Error(`Failed to download preview for ${sound.id}: HTTP ${audioRes.status}`);
  }
  const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

  const storagePath = `freesound/${sound.id}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, audioBuffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });
  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  const mergedTags = Array.from(new Set([...(sound.tags ?? []), ...(opts.extraTags ?? [])]));
  const kind = opts.kind ?? 'sfx';
  const maxDuration = kind === 'music' ? 180 : 30;
  const insertPayload = {
    name: opts.overrideName ?? sound.name,
    tags: mergedTags,
    audio_url: publicUrl,
    duration_sec: Math.min(Math.max(sound.duration, 0.1), maxDuration),
    source: opts.asCurated ? 'curated' : 'freesound',
    external_id: String(sound.id),
    kid_safe: true,           // Caller is responsible for picking kid-safe queries.
    attribution: attributionFor(sound),
    license: 'CC0' as const,
    kind,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('sfx_library')
    .insert(insertPayload)
    .select('id, name, tags, audio_url, duration_sec, source, external_id, attribution')
    .single();
  if (insertError || !inserted) {
    throw new Error(`Insert failed: ${insertError?.message || 'unknown'}`);
  }

  return inserted as ImportedSfx;
}
