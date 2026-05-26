/**
 * GET /api/v1/chapter-books/[id]/audio-pages
 *
 * Returns the chapter book's per-page audio status. For each current page
 * derived from the Tiptap doc, joins the matching `story_audio_pages` row (if
 * any) and computes a `stale` flag by comparing the row's `content_hash`
 * against the current page text hash. Drives the chapter-book editor's
 * stale-audio pill + the audio-generation client loop's skip-if-non-stale logic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { docToPages } from '@/lib/chapter-book/docToPages';
import { hashPageContent } from '@/lib/audio/content-hash';

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = ParamsSchema.parse(await params);
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, project_type, canvas_state')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (project.project_type !== 'chapter_book') {
      return NextResponse.json({ error: 'Not a chapter book' }, { status: 400 });
    }

    const allPages = docToPages(project.canvas_state as any);
    // Filter blank pages (image-only or empty pagebreak gaps) — they have no
    // narratable text, so they don't appear in audio status, don't count
    // toward "all pages have audio" for Spotify, and aren't generation targets.
    const currentPages = allPages.filter((p) => p.plainText.trim().length > 0);

    const { data: audioRows } = await supabase
      .from('story_audio_pages')
      .select('id, page_number, audio_url, audio_url_secondary, audio_duration_seconds, audio_source, content_hash, language, draft_vocal_url, draft_layers, draft_updated_at, committed_at')
      .eq('project_id', projectId)
      .order('page_number', { ascending: true });

    const audioByPage = new Map<number, any>();
    for (const row of audioRows ?? []) {
      audioByPage.set(row.page_number, row);
    }

    // PR 2 — lazy-initialise story_audio_pages rows for pages the user
    // can already see in the recorder but that haven't had TTS or recording
    // yet. Without a row, the page has no audio_page_id and the new draft
    // endpoints would have nothing to update. Insert minimal placeholder
    // rows for any missing page, then re-fetch so the IDs propagate.
    const missingPages = currentPages.filter((p) => !audioByPage.has(p.pageNumber));
    if (missingPages.length > 0) {
      const inserts = missingPages.map((p) => ({
        project_id: projectId,
        page_number: p.pageNumber,
        page_type: 'chapter_page' as const,
        generation_status: 'pending' as const,
        language: 'en',
        content_hash: hashPageContent(p.plainText),
      }));
      const { error: insertError } = await supabase
        .from('story_audio_pages')
        .insert(inserts);
      if (insertError) {
        // Non-fatal — log and continue with what we have. Save draft will
        // be disabled for these pages until the next refresh succeeds.
        console.warn('Failed to lazy-init audio_pages rows:', insertError);
      } else {
        const { data: newRows } = await supabase
          .from('story_audio_pages')
          .select('id, page_number, audio_url, audio_url_secondary, audio_duration_seconds, audio_source, content_hash, language, draft_vocal_url, draft_layers, draft_updated_at, committed_at')
          .eq('project_id', projectId)
          .in('page_number', missingPages.map((p) => p.pageNumber));
        for (const row of newRows ?? []) audioByPage.set(row.page_number, row);
      }
    }

    const pages = currentPages.map((page) => {
      const currentHash = hashPageContent(page.plainText);
      const row = audioByPage.get(page.pageNumber);
      const hasAudio = !!row?.audio_url;
      const stale = hasAudio && row.content_hash != null && row.content_hash !== currentHash;
      return {
        pageNumber: page.pageNumber,
        text: page.plainText,
        currentHash,
        hasAudio,
        stale,
        audioUrl: row?.audio_url ?? null,
        audioUrlSecondary: row?.audio_url_secondary ?? null,
        audioDurationSec: row?.audio_duration_seconds ?? null,
        audioSource: row?.audio_source ?? null,
        // PR 2 draft + commit metadata. audioPageId is the
        // story_audio_pages row's UUID; the recorder needs it to call
        // /save-draft, /shrink-source, and /render directly.
        audioPageId: row?.id ?? null,
        draftVocalUrl: row?.draft_vocal_url ?? null,
        draftLayers: row?.draft_layers ?? null,
        draftUpdatedAt: row?.draft_updated_at ?? null,
        committedAt: row?.committed_at ?? null,
      };
    });

    return NextResponse.json({ success: true, pages });
  } catch (error: any) {
    console.error('chapter-book audio-pages error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load audio pages' },
      { status: 500 }
    );
  }
}
