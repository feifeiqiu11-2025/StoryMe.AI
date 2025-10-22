/**
 * API Route: Publish Story to Spotify
 * POST /api/projects/[id]/publish-spotify
 *
 * Compiles story audio and publishes to Spotify via RSS feed
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AudioCompilationService } from '@/lib/services/audio-compilation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // 1. Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 3. Check if already published to Spotify
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
            error: 'Story already published to Spotify',
            spotifyUrl: existingPublication.external_url,
            status: existingPublication.status
          },
          { status: 409 }
        );
      }
      // If status is 'failed', we can retry - continue with the process
    }

    // 4. Verify audio exists for all scenes
    const { data: audioPages } = await supabase
      .from('story_audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .not('audio_url', 'is', null);

    // Count total scenes (including cover page which is page_number = 0)
    const { count: totalScenesCount } = await supabase
      .from('story_audio_pages')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId);

    const requiredAudioCount = totalScenesCount || 0;
    const hasAudioCount = audioPages?.length || 0;

    console.log(`📊 Audio validation: hasAudio=${hasAudioCount}, required=${requiredAudioCount}`);
    console.log(`📊 Audio pages with URLs:`, audioPages?.map(p => ({ page: p.page_number, hasUrl: !!p.audio_url })));

    if (hasAudioCount < requiredAudioCount) {
      console.log(`❌ Audio validation failed: ${hasAudioCount}/${requiredAudioCount}`);
      return NextResponse.json(
        {
          error: 'Please generate audio for all scenes before publishing to Spotify',
          hasAudio: hasAudioCount,
          required: requiredAudioCount
        },
        { status: 400 }
      );
    }

    console.log(`✅ Audio validation passed: ${hasAudioCount}/${requiredAudioCount}`);

    // 5. Prepare publication metadata
    const guid = `spotify-story-${projectId}`;
    const author = project.authorName && project.authorAge
      ? `${project.authorName} (age ${project.authorAge})`
      : project.authorName || 'KindleWood Author';

    const description = project.description ||
      `A magical story created by ${author} using KindleWood.`;

    // 6. Create or update publication record (status: compiling)
    let publicationId: string;

    if (existingPublication && existingPublication.status === 'failed') {
      // Retry failed publication
      publicationId = existingPublication.id;

      await supabase
        .from('publications')
        .update({
          status: 'compiling',
          error_message: null,
          requested_at: new Date().toISOString(),
        })
        .eq('id', publicationId);

      console.log(`🔄 Retrying failed publication ${publicationId}`);
    } else {
      // Create new publication
      const { data: publication, error: insertError } = await supabase
        .from('publications')
        .insert({
          project_id: projectId,
          user_id: user.id,
          platform: 'spotify',
          title: project.title,
          author: author,
          description: description,
          cover_image_url: project.coverImageUrl,
          guid: guid,
          status: 'compiling',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating publication record:', insertError);
        return NextResponse.json({ error: 'Failed to create publication' }, { status: 500 });
      }

      publicationId = publication.id;
      console.log(`✨ Created new Spotify publication ${publicationId}`);
    }

    // 7. Compile audio (runs synchronously - in production, consider background job)
    const compilationService = new AudioCompilationService(supabase);

    try {
      const result = await compilationService.compileAudiobook(projectId, publicationId);

      // 8. Update publication status to "published" (now in RSS feed)
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

      console.log(`✅ Publication ${publicationId} successfully published`);

      return NextResponse.json({
        success: true,
        message: 'Your story has been published to the KindleWood podcast! It will appear on Spotify within 1-6 hours.',
        publicationId: publicationId,
        status: 'published',
        estimatedLiveTime: '1-6 hours',
        audioUrl: result.compiledAudioUrl,
        duration: result.duration,
      });

    } catch (compilationError: any) {
      console.error('Audio compilation failed:', compilationError);

      // Update status to failed
      await supabase
        .from('publications')
        .update({
          status: 'failed',
          error_message: compilationError.message,
        })
        .eq('id', publicationId);

      return NextResponse.json({
        error: 'Audio compilation failed',
        details: compilationError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Spotify publish error:', error);
    return NextResponse.json({
      error: 'Failed to publish to Spotify',
      details: error.message
    }, { status: 500 });
  }
}
