/**
 * GET /api/v1/projects/[id]/audio-pages
 *
 * Authenticated companion to the public /api/projects/[id]/audio-pages
 * endpoint. Powers the picture-book recorder's hydration on open:
 *   - Lazy-inserts story_audio_pages rows for any narratable page that
 *     doesn't have one yet, so the PR 2 draft endpoints (Save draft /
 *     shrink-source / render) always have a row id to update.
 *   - Returns per-page entries with audioPageId + draft + commit metadata.
 *
 * Why a separate endpoint instead of extending the existing public one:
 *   - The public endpoint is consumed by the Kids App (anonymous read)
 *     and uses service role to bypass RLS. Adding write side effects to
 *     it would create orphan rows on every Kids App fetch.
 *   - Keeping them split means zero risk to the public endpoint's
 *     downstream consumers (status polling, Kids App audio playback).
 *
 * The chapter-book endpoint at /api/v1/chapter-books/[id]/audio-pages
 * does its own lazy-init + response composition. This endpoint mirrors
 * that pattern via the shared loadAudioPagesForProject helper.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { loadAudioPagesForProject, type NarratablePage } from '@/lib/audio/audio-pages.service';
import { hashPageContent } from '@/lib/audio/content-hash';
import type { AudioLayers } from '@/lib/audio/layers.types';

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

    // Load project + ownership + page list. Picture books store their
    // narratable content as story_scenes rows; chapter books use Tiptap
    // canvas_state. This endpoint targets the picture-book shape — the
    // chapter-book endpoint stays separate.
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, project_type, title')
      .eq('id', projectId)
      .single<{ id: string; user_id: string; project_type: string; title: string }>();
    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Scenes table is plain `scenes` (NOT `story_scenes` — that was a
    // wrong guess). Columns mirror what generate-story-audio.ts selects:
    // description + caption + scene_number. Picture-book covers don't
    // have a scene row; the cover text comes from project.title and is
    // page_number=1 by convention.
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('id, scene_number, description, caption')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });
    if (scenesError) {
      // Soft-fail with cover-only narratable pages so the recorder still
      // gets the cover's audioPageId. Logging keeps the issue visible.
      console.warn('Could not load scenes for project', projectId, scenesError);
    }

    // Page numbering MIRRORS the picture-book host's buildRecordingPages
    // exactly — the recorder's `pages` prop and our `audioPageId` mapping
    // must agree on what pageNumber means:
    //   - Page 1 = cover, text from project.title (no story_scenes row)
    //   - Pages 2..N+1 = scenes in scene_number order
    //   - Quiz pages live at higher indices in the host but are skipped
    //     in this endpoint (their audio uses a separate generation path
    //     and is out of scope for v1 recorder hydration).
    // Always include the cover (pageNumber=1) since the recorder always
    // shows it. Use project.title as the source of truth, falling back
    // to empty string + empty hash if missing (lazy-init still creates
    // a row so save-draft can attach to the cover).
    const narratablePages: NarratablePage[] = [];
    const coverText = (project.title || '').trim();
    narratablePages.push({
      pageNumber: 1,
      text: coverText,
      contentHash: coverText ? hashPageContent(coverText) : '',
      pageType: 'cover',
    });
    // Include EVERY scene regardless of text content — the host's
    // buildRecordingPages does the same, so the recorder will display
    // these pages and they must have an audio_page_id for save-draft
    // and edit-existing to work. Empty captions/descriptions just get
    // a blank hash (stale detection becomes a no-op).
    // `caption || description` (logical OR) so an empty string falls
    // through to description — matches buildRecordingPages and
    // generate-story-audio. Using `??` here was a bug: it kept "" and
    // then filtered the scene out, hiding TTS audio for those pages.
    let nextPageNumber = narratablePages.length + 1;
    for (const scene of (scenes ?? []) as Array<{
      id: string;
      scene_number: number;
      description: string | null;
      caption: string | null;
    }>) {
      const sceneText = (scene.caption || scene.description || '').trim();
      narratablePages.push({
        pageNumber: nextPageNumber++,
        text: sceneText,
        contentHash: sceneText ? hashPageContent(sceneText) : '',
        pageType: 'scene',
      });
    }

    const { rowsByPage } = await loadAudioPagesForProject(supabase, projectId, narratablePages);

    // Compose per-page response. Same shape (camelCased fields) as the
    // chapter-book endpoint so the Recorder's existingPageDrafts +
    // existingPageAudio handling is identical across project types.
    const pages = narratablePages.map((p) => {
      const row = rowsByPage.get(p.pageNumber);
      const hasAudio = !!row?.audio_url;
      const stale = hasAudio && row?.content_hash != null && row.content_hash !== p.contentHash;
      return {
        pageNumber: p.pageNumber,
        text: p.text,
        currentHash: p.contentHash,
        hasAudio,
        stale,
        audioUrl: row?.audio_url ?? null,
        audioUrlSecondary: row?.audio_url_secondary ?? null,
        audioDurationSec: row?.audio_duration_seconds ?? null,
        audioSource: row?.audio_source ?? null,
        // PR 2 draft + commit metadata.
        audioPageId: row?.id ?? null,
        draftVocalUrl: row?.draft_vocal_url ?? null,
        draftLayers: (row?.draft_layers ?? null) as AudioLayers | null,
        draftUpdatedAt: row?.draft_updated_at ?? null,
        committedAt: row?.committed_at ?? null,
      };
    });

    return NextResponse.json({ success: true, pages });
  } catch (error: any) {
    console.error('GET /api/v1/projects/[id]/audio-pages error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load audio pages' },
      { status: 500 }
    );
  }
}
