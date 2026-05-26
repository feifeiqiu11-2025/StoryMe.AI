/**
 * Client-side helpers for the PR 2 audio-page draft lifecycle.
 *
 * All three calls are scoped to a `story_audio_pages` row id (audioPageId).
 * The recorder gets that id from the chapter-book audio-pages GET response.
 */

import type { AudioLayers, VocalSegment } from './layers.types';

export interface SaveDraftArgs {
  audioPageId: string;
  /** Omit when the blob hasn't changed since the last save (pure
   *  layer-edit autosaves skip the blob upload). */
  vocalBlob?: Blob;
  layers: AudioLayers;
}

export interface SaveDraftResult {
  draftVocalUrl: string | null;
  draftUpdatedAt: string;
}

export async function saveDraft({ audioPageId, vocalBlob, layers }: SaveDraftArgs): Promise<SaveDraftResult> {
  const form = new FormData();
  form.set('layers', JSON.stringify(layers));
  if (vocalBlob) {
    // The filename hints at the codec for storage uploads. Browser blobs
    // recorded via MediaRecorder are typically `audio/webm`, but a server
    // shrink-source returns MP3. Pick an extension from the MIME.
    const type = vocalBlob.type || 'audio/webm';
    const ext = type.includes('webm') ? 'webm'
      : type.includes('mp4') ? 'm4a'
      : type.includes('wav') ? 'wav'
      : type.includes('mpeg') ? 'mp3'
      : 'webm';
    form.set('vocal', new File([vocalBlob], `draft.${ext}`, { type }));
  }
  const res = await fetch(`/api/v1/audio-pages/${audioPageId}/save-draft`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return {
    draftVocalUrl: data.draft_vocal_url ?? null,
    draftUpdatedAt: data.draft_updated_at,
  };
}

export interface ShrinkSourceResult {
  draftVocalUrl: string;
  durationSec: number;
  segments: VocalSegment[];
  draftUpdatedAt: string;
}

export async function shrinkSource(audioPageId: string, keepSegments: VocalSegment[]): Promise<ShrinkSourceResult> {
  const res = await fetch(`/api/v1/audio-pages/${audioPageId}/shrink-source`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keepSegments }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return {
    draftVocalUrl: data.draft_vocal_url,
    durationSec: data.durationSec,
    segments: data.segments,
    draftUpdatedAt: data.draft_updated_at,
  };
}

export interface RenderResult {
  audioUrl: string;
  committedAt: string;
}

export async function renderFinal(audioPageId: string): Promise<RenderResult> {
  const res = await fetch(`/api/v1/audio-pages/${audioPageId}/render`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return {
    audioUrl: data.audioUrl,
    committedAt: data.committed_at,
  };
}
