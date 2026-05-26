/**
 * POST /api/v1/audio-pages/[id]/render
 *
 * "Finish & Continue" — takes the current draft (draft_vocal_url +
 * draft_layers), runs mix.service, writes the result to audio_url, stamps
 * committed_at, and clears the draft columns. After this the page is in
 * the committed state; re-opening initialises a fresh draft from the new
 * committed audio.
 *
 * Idempotent in the sense that calling twice in a row will just re-render
 * the same draft into a slightly newer audio_url (and re-clear the draft).
 *
 * Body: none. Reads everything it needs from the row.
 * Response: { success, audioUrl, committed_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { updatePageLayers } from '@/lib/audio/layers.service';
import type { AudioLayers } from '@/lib/audio/layers.types';

export const maxDuration = 60;

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: audioPageId } = ParamsSchema.parse(await params);
    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: page, error: pageError } = await supabase
      .from('story_audio_pages')
      .select('id, project_id, page_number, draft_vocal_url, draft_layers, projects!inner(user_id)')
      .eq('id', audioPageId)
      .single<{
        id: string;
        project_id: string;
        page_number: number;
        draft_vocal_url: string | null;
        draft_layers: AudioLayers | null;
        projects: { user_id: string };
      }>();
    if (pageError || !page) {
      return NextResponse.json({ error: 'Audio page not found' }, { status: 404 });
    }
    if (page.projects.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!page.draft_layers) {
      return NextResponse.json({ error: 'No draft to render — Save draft first' }, { status: 400 });
    }

    // The vocal URL inside draft_layers MUST point at the row's
    // draft_vocal_url (or a valid CDN URL); the mix service fetches from
    // whatever URL the layers reference. We trust draft_layers as written.
    let mixResult;
    try {
      mixResult = await updatePageLayers(
        supabase,
        page.id,
        page.project_id,
        page.page_number,
        page.draft_layers,
      );
    } catch (err: any) {
      console.error('updatePageLayers failed in /render:', err);
      return NextResponse.json(
        { error: err.message || 'Mix render failed' },
        { status: 500 }
      );
    }

    // Commit transition: clear the draft so re-opens initialise from the
    // new audio_url. We've already written audio_url + audio_layers in
    // updatePageLayers; this finalises the lifecycle stamp.
    const now = new Date().toISOString();
    const { error: clearError } = await supabase
      .from('story_audio_pages')
      .update({
        committed_at: now,
        draft_vocal_url: null,
        draft_layers: null,
        draft_updated_at: null,
      })
      .eq('id', audioPageId);
    if (clearError) {
      console.error('Failed to clear draft after render:', clearError);
      // Non-fatal — audio_url is correct, draft just lingers. Surface but
      // don't error the response.
    }

    return NextResponse.json({
      success: true,
      audioUrl: mixResult.audioUrl,
      committed_at: now,
    });
  } catch (error: any) {
    console.error('POST /api/v1/audio-pages/[id]/render error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to render audio' },
      { status: 500 }
    );
  }
}
