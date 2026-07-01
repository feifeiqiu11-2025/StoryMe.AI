/**
 * POST /api/v1/audio-pages/[id]/save-draft
 *
 * Persists an in-progress audio edit. Two pieces of state, both optional
 * per request:
 *   - `vocal` (multipart file): the raw vocal blob. Only sent when the
 *     blob has changed since the last save (new recording, post-destructive
 *     delete, etc.). When present, replaces draft_vocal_url.
 *   - `layers` (JSON string): the full AudioLayers spec (segments, effects,
 *     volumes, etc.). Always required — at minimum we need to know the
 *     current edit state.
 *
 * Does NOT trim or mix. Vocal is stored raw so it can survive into the
 * next editing session intact. Mix happens later in /render.
 *
 * Response:
 *   { success: true, draft_vocal_url, draft_updated_at }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { AudioLayersSchema } from '@/lib/audio/layers.types';
import { processAndUploadRecording, EmptyRecordingError } from '@/lib/audio/upload-recording.service';

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
      .select('id, project_id, page_number, projects!inner(user_id)')
      .eq('id', audioPageId)
      .single<{ id: string; project_id: string; page_number: number; projects: { user_id: string } }>();
    if (pageError || !page) {
      return NextResponse.json({ error: 'Audio page not found' }, { status: 404 });
    }
    if (page.projects.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await request.formData();
    const layersRaw = formData.get('layers');
    if (typeof layersRaw !== 'string') {
      return NextResponse.json({ error: 'Missing layers field' }, { status: 400 });
    }
    let layers;
    try {
      layers = AudioLayersSchema.parse(JSON.parse(layersRaw));
    } catch (err: any) {
      return NextResponse.json({ error: 'Invalid layers JSON', details: err.issues ?? err.message }, { status: 400 });
    }

    const vocal = formData.get('vocal');
    let draftVocalUrl: string | undefined;
    if (vocal instanceof File && vocal.size > 0) {
      // Route through processAndUploadRecording so WebM blobs (the
      // default for MediaRecorder) get converted to MP3 before storage.
      // MP3 is universally decodable: iOS Safari's <audio>, Web Audio
      // decodeAudioData, and the shrink-source FFmpeg pipeline all need
      // it. No trim params — we want to preserve the full raw take so
      // the user can drag the outer trim back out during editing.
      const result = await processAndUploadRecording({
        supabase,
        projectId: page.project_id,
        pageNumber: page.page_number,
        audioFile: vocal,
        subfolder: 'drafts',
      });
      draftVocalUrl = result.audioUrl;
    }

    // The client builds layers from in-memory state, which includes a
    // local blob:// URL for the vocal — useless to anyone but the
    // recording session that created it. Rewrite to the persisted URL
    // (either the one we just uploaded OR the prior draft_vocal_url)
    // so /render and re-hydration can fetch the audio later.
    let persistedVocalUrl: string | null = draftVocalUrl ?? null;
    if (!persistedVocalUrl) {
      const { data: priorRow } = await supabase
        .from('story_audio_pages')
        .select('draft_vocal_url')
        .eq('id', audioPageId)
        .single<{ draft_vocal_url: string | null }>();
      persistedVocalUrl = priorRow?.draft_vocal_url ?? null;
    }
    if (persistedVocalUrl) {
      layers.vocal.url = persistedVocalUrl;
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      draft_layers: layers,
      draft_updated_at: now,
    };
    if (draftVocalUrl) update.draft_vocal_url = draftVocalUrl;

    const { error: updateError } = await supabase
      .from('story_audio_pages')
      .update(update)
      .eq('id', audioPageId);
    if (updateError) {
      return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      draft_vocal_url: draftVocalUrl ?? null,
      draft_updated_at: now,
    });
  } catch (error: any) {
    // An empty/degenerate recording is a user-input problem, not a server
    // fault — return 400 so it surfaces as "please record again" without
    // polluting error monitoring. The prior draft is left untouched (the
    // update below never ran), so a good earlier take is preserved.
    if (error instanceof EmptyRecordingError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/v1/audio-pages/[id]/save-draft error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}
