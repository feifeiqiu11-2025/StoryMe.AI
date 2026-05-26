/**
 * Shared TTS-to-storage primitive used by both picture-book and chapter-book
 * audio generation routes. Wraps Azure Neural TTS synthesis + upload to the
 * `story-audio-files` Supabase bucket.
 *
 * Does NOT touch the `story_audio_pages` table — callers own that row write
 * because picture book and chapter book have different schema concerns
 * (bilingual EN/secondary column handling, page_type variations, quiz linkage).
 */

import { getAzureTTSClient, isAzureTTSAvailable } from '@/lib/azure-tts-client';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SynthesizeAndStoreParams {
  supabase: SupabaseClient;
  projectId: string;
  pageNumber: number;
  text: string;
  language: string;
  tone?: string;
  /** Optional sub-folder under `{projectId}/`. Default: language-keyed name at root. */
  storagePathOverride?: string;
}

export interface SynthesizeAndStoreResult {
  audioUrl: string;
  storagePath: string;
  fileSizeBytes: number;
  estimatedDurationSec: number;
}

const STORAGE_BUCKET = 'story-audio-files';

export function ensureTTSAvailable(): void {
  if (!isAzureTTSAvailable()) {
    throw new Error('Azure TTS not configured (missing AZURE_SPEECH_KEY or AZURE_SPEECH_REGION).');
  }
}

export async function synthesizeAndStore(
  params: SynthesizeAndStoreParams,
): Promise<SynthesizeAndStoreResult> {
  const { supabase, projectId, pageNumber, text, language, tone = 'default', storagePathOverride } = params;
  ensureTTSAvailable();

  const azureTTS = getAzureTTSClient();
  const result = await azureTTS.synthesize(text, tone, language);
  const buffer = result.audioBuffer;

  const storagePath = storagePathOverride
    ?? `${projectId}/page-${pageNumber}-${language}-${Date.now()}.mp3`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: 'audio/mpeg',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    audioUrl: publicUrl,
    storagePath,
    fileSizeBytes: buffer.length,
    estimatedDurationSec: Math.round(result.durationMs / 1000),
  };
}
