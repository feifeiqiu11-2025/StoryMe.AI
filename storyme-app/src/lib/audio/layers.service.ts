/**
 * Layers service — orchestrates the layer-edit lifecycle:
 *   1. validate the incoming AudioLayers JSON
 *   2. mix to MP3 via mix.service
 *   3. upload mixed MP3 to Supabase storage
 *   4. update story_audio_pages.{audio_url, audio_layers, audio_filename}
 *
 * Decouples API routes from FFmpeg + storage details. Routes do auth +
 * ownership, then call updatePageLayers().
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AudioLayers, AudioLayersSchema } from './layers.types';
import { mixLayersToMp3 } from './mix.service';

const STORAGE_BUCKET = 'story-audio-files';

export interface UpdateLayersResult {
  audioUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  layers: AudioLayers;
}

/** Validate and persist a new layer composition for a `story_audio_pages` row.
 *  Returns the new mixed audio URL the row was updated with. */
export async function updatePageLayers(
  supabase: SupabaseClient,
  audioPageId: string,
  projectId: string,
  pageNumber: number,
  rawLayers: unknown,
): Promise<UpdateLayersResult> {
  const layers = AudioLayersSchema.parse(rawLayers);

  const mixedBuffer = await mixLayersToMp3(layers);

  const storagePath = `${projectId}/mixed/page-${pageNumber}-${Date.now()}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, mixedBuffer, {
      contentType: 'audio/mpeg',
      upsert: false,
    });
  if (uploadError) throw new Error(`Mix upload failed: ${uploadError.message}`);

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  const { error: updateError } = await supabase
    .from('story_audio_pages')
    .update({
      audio_url: publicUrl,
      audio_filename: storagePath,
      audio_layers: layers,
      audio_duration_seconds: estimateDurationSec(layers),
      generation_status: 'completed',
    })
    .eq('id', audioPageId);
  if (updateError) throw new Error(`DB update failed: ${updateError.message}`);

  return {
    audioUrl: publicUrl,
    storagePath,
    fileSizeBytes: mixedBuffer.length,
    layers,
  };
}

/** Conservative duration estimate — the max of vocal (post-trim) and the
 *  latest-ending music/effect. Mix `duration=longest` matches this. */
function estimateDurationSec(layers: AudioLayers): number {
  const vocalEnd = (layers.vocal.trimEndSec ?? layers.vocal.durationSec)
    - (layers.vocal.trimStartSec ?? 0);
  const layerEnds = [
    ...layers.music.map((m) => m.startSec + m.durationSec),
    ...layers.effects.map((e) => e.startSec + e.durationSec),
  ];
  return Math.max(vocalEnd, ...layerEnds, 0);
}
