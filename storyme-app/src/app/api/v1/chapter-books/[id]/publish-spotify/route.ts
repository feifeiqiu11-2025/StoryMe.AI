/**
 * POST /api/v1/chapter-books/[id]/publish-spotify
 *
 * Compiles the chapter book's per-page audio into a single MP3 audiobook and
 * creates the publications row that the podcast RSS feed reads. Mirrors the
 * picture-book equivalent at /api/projects/[id]/publish-spotify; both routes
 * reuse the content-agnostic AudioCompilationService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { AudioCompilationService } from '@/lib/services/audio-compilation.service';
import { docToPages } from '@/lib/chapter-book/docToPages';

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }
    if (project.project_type !== 'chapter_book') {
      return NextResponse.json({ error: 'Not a chapter book' }, { status: 400 });
    }

    // Ensure audio exists for every narratable page. Blank pages (image-only
    // or empty pagebreak gaps) are skipped — they don't need narration and
    // shouldn't block publication.
    const currentPages = docToPages(project.canvas_state as any)
      .filter((p) => p.plainText.trim().length > 0);
    const { data: audioRows } = await supabase
      .from('story_audio_pages')
      .select('page_number, audio_url')
      .eq('project_id', projectId)
      .not('audio_url', 'is', null);

    const pagesWithAudio = new Set((audioRows ?? []).map((r) => r.page_number));
    const missing = currentPages
      .filter((p) => !pagesWithAudio.has(p.pageNumber))
      .map((p) => p.pageNumber);
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: 'Please generate audio for every page before publishing to Spotify',
          missingPages: missing,
        },
        { status: 400 }
      );
    }

    const { data: existingPublication } = await supabase
      .from('publications')
      .select('*')
      .eq('project_id', projectId)
      .eq('platform', 'spotify')
      .single();

    if (existingPublication) {
      if (existingPublication.status === 'compiling') {
        return NextResponse.json(
          { error: 'Audio compilation already in progress' },
          { status: 409 }
        );
      }
      if (existingPublication.status === 'published' || existingPublication.status === 'live') {
        return NextResponse.json(
          {
            error: 'Chapter book already published to Spotify',
            spotifyUrl: existingPublication.external_url,
            status: existingPublication.status,
          },
          { status: 409 }
        );
      }
    }

    const guid = `spotify-story-${projectId}`;
    const author = project.authorName && project.authorAge
      ? `${project.authorName} (age ${project.authorAge})`
      : project.authorName || 'KindleWood Author';
    const description = project.description
      || `A chapter book by ${author}, created with KindleWood.`;

    let publicationId: string;
    if (existingPublication && existingPublication.status === 'failed') {
      publicationId = existingPublication.id;
      await supabase
        .from('publications')
        .update({
          status: 'compiling',
          error_message: null,
          requested_at: new Date().toISOString(),
        })
        .eq('id', publicationId);
    } else {
      const { data: publication, error: insertError } = await supabase
        .from('publications')
        .insert({
          project_id: projectId,
          user_id: user.id,
          platform: 'spotify',
          title: project.title,
          author,
          description,
          cover_image_url: project.cover_image_url,
          guid,
          status: 'compiling',
        })
        .select()
        .single();
      if (insertError || !publication) {
        return NextResponse.json({ error: 'Failed to create publication' }, { status: 500 });
      }
      publicationId = publication.id;
    }

    const compilationService = new AudioCompilationService(supabase);
    try {
      const result = await compilationService.compileAudiobook(projectId, publicationId);
      await supabase
        .from('publications')
        .update({
          compiled_audio_url: result.compiledAudioUrl,
          audio_duration_seconds: result.duration,
          file_size_bytes: result.fileSize,
          status: 'published',
          compiled_at: new Date().toISOString(),
          published_at: new Date().toISOString(),
          error_message: null,
        })
        .eq('id', publicationId);

      return NextResponse.json({
        success: true,
        message: 'Your chapter book has been published to the KindleWood podcast! It will appear on Spotify within 1-6 hours.',
        publicationId,
        status: 'published',
        estimatedLiveTime: '1-6 hours',
        audioUrl: result.compiledAudioUrl,
        duration: result.duration,
      });
    } catch (compilationError: any) {
      await supabase
        .from('publications')
        .update({
          status: 'failed',
          error_message: compilationError.message,
        })
        .eq('id', publicationId);
      return NextResponse.json(
        { error: 'Audio compilation failed', details: compilationError.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('chapter-book publish-spotify error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to publish to Spotify' },
      { status: 500 }
    );
  }
}
