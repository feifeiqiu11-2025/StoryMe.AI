/**
 * PATCH /api/v1/audio-pages/[id]/layers
 *
 * Updates the layer composition for a single story_audio_pages row,
 * re-mixes via mix.service, uploads the new mix, and updates the row's
 * audio_url. Content-type agnostic — works for picture-book and chapter-
 * book pages because the row encapsulates project_id; auth uses that for
 * ownership.
 *
 * Body: AudioLayers JSON (see lib/audio/layers.types.ts).
 * Response: { success, audioUrl, fileSizeBytes }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { updatePageLayers } from '@/lib/audio/layers.service';

export const maxDuration = 60;

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function PATCH(
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

    // Load the page + parent project for ownership check.
    const { data: page, error: pageError } = await supabase
      .from('story_audio_pages')
      .select('id, project_id, page_number, projects!inner(user_id)')
      .eq('id', audioPageId)
      .single<{ id: string; project_id: string; page_number: number; projects: { user_id: string } }>();
    if (pageError || !page) {
      return NextResponse.json({ error: 'Audio page not found' }, { status: 404 });
    }
    if (page.projects.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    let result;
    try {
      result = await updatePageLayers(
        supabase,
        page.id,
        page.project_id,
        page.page_number,
        body,
      );
    } catch (err: any) {
      if (err.name === 'ZodError') {
        return NextResponse.json(
          { error: 'Invalid layer payload', details: err.issues },
          { status: 400 }
        );
      }
      console.error('updatePageLayers failed:', err);
      return NextResponse.json(
        { error: err.message || 'Mix failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      audioUrl: result.audioUrl,
      fileSizeBytes: result.fileSizeBytes,
    });
  } catch (error: any) {
    console.error('PATCH /api/v1/audio-pages/[id]/layers error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update layers' },
      { status: 500 }
    );
  }
}
