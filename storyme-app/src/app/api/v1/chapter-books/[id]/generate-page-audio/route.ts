/**
 * POST /api/v1/chapter-books/[id]/generate-page-audio
 *
 * Generates Azure TTS audio for ONE chapter-book page. Called repeatedly by
 * the client (page 1, page 2, ...) so each request is bounded by the
 * per-page synthesis time — keeps us well under Vercel's 60s limit even on
 * long pages.
 *
 * Behavior:
 *   - Loads the project's editor_doc, runs docToPages, picks the requested
 *     page by 1-based pageNumber.
 *   - Computes content_hash; if an existing row for this page already has a
 *     matching hash AND has audio, skips generation and returns the existing
 *     URL. This makes resuming a partially-completed generation cheap.
 *   - Otherwise synthesizes via the shared tts.service primitive and upserts
 *     the story_audio_pages row with audio_source='ai_tts' + content_hash.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { docToPages } from '@/lib/chapter-book/docToPages';
import { hashPageContent } from '@/lib/audio/content-hash';
import { synthesizeAndStore } from '@/lib/audio/tts.service';

export const maxDuration = 60;

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({
  pageNumber: z.number().int().min(1),
  language: z.string().min(2).max(10).default('en'),
  /** If true, regenerate even if hash matches (force re-narrate). */
  force: z.boolean().optional().default(false),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = ParamsSchema.parse(await params);
    const body = BodySchema.parse(await request.json());

    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, project_type, canvas_state, story_tone')
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

    const pages = docToPages(project.canvas_state as any);
    const page = pages.find((p) => p.pageNumber === body.pageNumber);
    if (!page) {
      return NextResponse.json(
        { error: `Page ${body.pageNumber} not found (chapter book has ${pages.length} pages)` },
        { status: 404 }
      );
    }
    if (!page.plainText.trim()) {
      // Blank page (image-only, page-break gap, etc.) — not an error. Tell the
      // client to skip so the generation loop just moves on quietly.
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'empty page',
        audioUrl: null,
      });
    }

    const contentHash = hashPageContent(page.plainText);

    // Skip-if-non-stale: existing row with matching hash and an audio URL for
    // this language already exists — return it without burning a TTS call.
    const audioUrlField = body.language === 'en' ? 'audio_url' : 'audio_url_secondary';
    const { data: existing } = await supabase
      .from('story_audio_pages')
      .select(`id, content_hash, ${audioUrlField}, audio_duration_seconds`)
      .eq('project_id', projectId)
      .eq('page_number', body.pageNumber)
      .maybeSingle() as { data: any };

    if (
      !body.force
      && existing
      && existing.content_hash === contentHash
      && existing[audioUrlField]
    ) {
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'audio already current',
        audioUrl: existing[audioUrlField],
        durationSec: existing.audio_duration_seconds,
        contentHash,
      });
    }

    const tone = (project as any).story_tone || 'default';
    let synth;
    try {
      synth = await synthesizeAndStore({
        supabase,
        projectId,
        pageNumber: body.pageNumber,
        text: page.plainText,
        language: body.language,
        tone,
      });
    } catch (synthError: any) {
      return NextResponse.json(
        { error: synthError.message || 'TTS generation failed' },
        { status: 502 }
      );
    }

    const baseRow = {
      project_id: projectId,
      page_number: body.pageNumber,
      page_type: 'chapter_page',
      text_content: page.plainText,
      audio_source: 'ai_tts',
      generation_status: 'completed',
      audio_duration_seconds: synth.estimatedDurationSec,
      content_hash: contentHash,
      language: body.language,
    } as Record<string, any>;
    if (body.language === 'en') {
      baseRow.audio_url = synth.audioUrl;
      baseRow.audio_filename = synth.storagePath;
    } else {
      baseRow.audio_url_secondary = synth.audioUrl;
    }

    if (existing) {
      await supabase
        .from('story_audio_pages')
        .update(baseRow)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('story_audio_pages')
        .insert(baseRow);
    }

    return NextResponse.json({
      success: true,
      audioUrl: synth.audioUrl,
      durationSec: synth.estimatedDurationSec,
      contentHash,
    });
  } catch (error: any) {
    console.error('chapter-book generate-page-audio error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate page audio' },
      { status: 500 }
    );
  }
}
