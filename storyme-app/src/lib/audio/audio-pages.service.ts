/**
 * Shared helper for the per-project audio-pages endpoints. Both the
 * chapter-book endpoint (in /api/v1/chapter-books) and the picture-book
 * endpoint (in /api/projects) need the same SELECT + lazy-INSERT logic
 * around `story_audio_pages` — this file holds that logic so each
 * endpoint just has to derive its content-type-specific page list and
 * pass it in.
 *
 * The helper is intentionally agnostic to:
 *   - How the caller derives narratable pages (Tiptap doc vs scenes)
 *   - What stale-detection or aggregate logic the response wraps around
 *     the per-page rows
 *
 * Caller responsibility:
 *   1. Derive an array of narratable pages, each with pageNumber + text +
 *      pageType + a content hash (when stale detection is relevant).
 *   2. Call loadAudioPagesForProject() — receives raw rows back keyed by
 *      pageNumber.
 *   3. Compose the response shape its consumers expect.
 *
 * Lazy-init: any page in the input list without a story_audio_pages row
 * gets one inserted before the helper returns. This lets the PR 2 draft
 * endpoints (Save draft / shrink-source / render) operate on every page
 * the recorder can reach — they need a row id to update.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AudioLayers } from './layers.types';

/** What the helper needs from each narratable page. The hash is required
 *  because we backfill content_hash on the lazy-INSERT — if the caller
 *  doesn't have a sensible hash, pass empty string and the row's stale
 *  detection becomes a no-op. */
export interface NarratablePage {
  pageNumber: number;
  text: string;
  /** Stored on the row's content_hash column for stale detection. */
  contentHash: string;
  /** story_audio_pages.page_type. Must match the column's CHECK
   *  constraint: 'cover' | 'scene' | 'chapter_page' | 'quiz_transition'
   *  | 'quiz_question'. */
  pageType: 'cover' | 'scene' | 'chapter_page' | 'quiz_transition' | 'quiz_question';
}

export interface AudioPageRow {
  id: string;
  page_number: number;
  audio_url: string | null;
  audio_url_secondary: string | null;
  audio_duration_seconds: number | null;
  audio_source: 'ai_tts' | 'user_recorded' | 'ai_voice_clone' | null;
  content_hash: string | null;
  language: string | null;
  draft_vocal_url: string | null;
  draft_layers: AudioLayers | null;
  draft_updated_at: string | null;
  committed_at: string | null;
}

/** Common columns selected by both audio-pages endpoints. Centralised so
 *  schema changes only need to update this one string. */
const SELECT_COLUMNS = [
  'id',
  'page_number',
  'audio_url',
  'audio_url_secondary',
  'audio_duration_seconds',
  'audio_source',
  'content_hash',
  'language',
  'draft_vocal_url',
  'draft_layers',
  'draft_updated_at',
  'committed_at',
].join(', ');

export interface LoadAudioPagesResult {
  /** Per-page rows keyed by 1-based page number. Every NarratablePage in
   *  the input has an entry here after the lazy-INSERT step succeeds. */
  rowsByPage: Map<number, AudioPageRow>;
  /** True if at least one row was inserted as part of lazy-init. Callers
   *  can use this to log/track without re-querying. */
  didInsert: boolean;
}

export async function loadAudioPagesForProject(
  supabase: SupabaseClient,
  projectId: string,
  narratablePages: NarratablePage[],
): Promise<LoadAudioPagesResult> {
  const rowsByPage = new Map<number, AudioPageRow>();
  let didInsert = false;

  // Initial fetch — what rows already exist?
  const { data: existingRows, error: fetchError } = await supabase
    .from('story_audio_pages')
    .select(SELECT_COLUMNS)
    .eq('project_id', projectId)
    .order('page_number', { ascending: true });
  if (fetchError) {
    // Surface as an empty map — callers can decide how to react. Logging
    // here keeps the failure visible without crashing the whole endpoint.
    console.warn('loadAudioPagesForProject: initial select failed:', fetchError);
    return { rowsByPage, didInsert };
  }
  for (const row of (existingRows ?? []) as AudioPageRow[]) {
    rowsByPage.set(row.page_number, row);
  }

  // Lazy-init: any narratable page without a row gets one. Necessary so
  // the recorder's PR 2 draft endpoints (which key off audio_page_id)
  // have something to UPDATE.
  const missing = narratablePages.filter((p) => !rowsByPage.has(p.pageNumber));
  if (missing.length === 0) return { rowsByPage, didInsert };

  const inserts = missing.map((p) => ({
    project_id: projectId,
    page_number: p.pageNumber,
    page_type: p.pageType,
    generation_status: 'pending' as const,
    language: 'en',
    content_hash: p.contentHash,
  }));
  const { error: insertError } = await supabase
    .from('story_audio_pages')
    .insert(inserts);
  if (insertError) {
    // Non-fatal: callers get back whatever rows already existed. Save
    // draft and destructive delete remain disabled for the missing
    // pages until the next refresh succeeds, but rendering existing
    // rows continues to work.
    console.warn('loadAudioPagesForProject: lazy-init insert failed:', insertError);
    return { rowsByPage, didInsert };
  }
  didInsert = true;

  // Re-fetch just the missing page numbers so we pick up the new rows'
  // server-generated ids.
  const { data: newRows, error: refetchError } = await supabase
    .from('story_audio_pages')
    .select(SELECT_COLUMNS)
    .eq('project_id', projectId)
    .in('page_number', missing.map((p) => p.pageNumber));
  if (refetchError) {
    console.warn('loadAudioPagesForProject: post-insert refetch failed:', refetchError);
    return { rowsByPage, didInsert };
  }
  for (const row of (newRows ?? []) as AudioPageRow[]) {
    rowsByPage.set(row.page_number, row);
  }
  return { rowsByPage, didInsert };
}
