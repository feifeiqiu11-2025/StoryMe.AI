/**
 * Public Story Detail API
 * GET /api/stories/public/[id] - Get full story details (no auth required for public stories)
 * POST /api/stories/public/[id] - Increment view/share count
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const tokenParam = request.nextUrl.searchParams.get('token');

    const supabase = await createClient();

    // Fetch full story with all scenes and images
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        visibility,
        share_token,
        featured,
        view_count,
        like_count,
        share_count,
        published_at,
        reading_level,
        story_tone,
        created_at,
        cover_image_url,
        author_name,
        author_age,
        secondary_language,
        scenes (
          id,
          scene_number,
          description,
          caption,
          caption_chinese,
          caption_secondary,
          generated_images (
            id,
            image_url,
            prompt
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Story not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Access gate: public stories are open. Unlisted stories require a matching
    // share-link token. Anything else (private, mismatched token) is rejected
    // with the same 403 to avoid leaking visibility state to scrapers.
    const isPublic = project.visibility === 'public';
    const isUnlistedWithMatchingToken =
      project.visibility === 'unlisted' &&
      !!project.share_token &&
      !!tokenParam &&
      tokenParam === project.share_token;

    if (!isPublic && !isUnlistedWithMatchingToken) {
      return NextResponse.json(
        { error: 'This story is private' },
        { status: 403 }
      );
    }

    // Counters are frozen for unlisted (token-served) views — only public
    // views accrue analytics so unlisted stays a clean "preview" channel.
    const incrementViews = isPublic;
    if (incrementViews) {
      await supabase
        .from('projects')
        .update({ view_count: (project.view_count || 0) + 1 })
        .eq('id', id);
    }

    // Format response
    const formattedProject = {
      id: project.id,
      title: project.title,
      description: project.description,
      visibility: project.visibility,
      featured: project.featured,
      viewCount: incrementViews ? (project.view_count || 0) + 1 : (project.view_count || 0),
      likeCount: project.like_count,
      shareCount: project.share_count,
      publishedAt: project.published_at,
      readingLevel: project.reading_level,
      storyTone: project.story_tone,
      createdAt: project.created_at,
      coverImageUrl: project.cover_image_url,
      authorName: project.author_name,
      authorAge: project.author_age,
      secondaryLanguage: project.secondary_language,
      scenes: project.scenes
        ?.sort((a: any, b: any) => a.scene_number - b.scene_number)
        .map((scene: any) => ({
          id: scene.id,
          sceneNumber: scene.scene_number,
          description: scene.description,
          caption: scene.caption,
          captionChinese: scene.caption_chinese,
          captionSecondary: scene.caption_secondary,
          imageUrl: scene.generated_images?.[0]?.image_url || null,
          prompt: scene.generated_images?.[0]?.prompt || null,
        })) || [],
    };

    return NextResponse.json({
      success: true,
      story: formattedProject,
    });

  } catch (error) {
    console.error('Error fetching public story:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action, platform } = body; // action: 'view' | 'share', platform: 'twitter' | 'facebook' | etc.

    if (!action || !['view', 'share'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "view" or "share"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify story exists and is public
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, visibility, view_count, share_count')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    // Counters are only tracked for public stories. Unlisted views are a
    // private channel and don't accrue view/share metrics.
    if (project.visibility !== 'public') {
      return NextResponse.json(
        { error: 'This story is private' },
        { status: 403 }
      );
    }

    // Increment the appropriate counter
    const updateField = action === 'view' ? 'view_count' : 'share_count';
    const currentValue = action === 'view' ? project.view_count : project.share_count;

    const { error: updateError } = await supabase
      .from('projects')
      .update({ [updateField]: (currentValue || 0) + 1 })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // TODO: Track share platform in analytics table (future enhancement)

    return NextResponse.json({
      success: true,
      action,
      newCount: (currentValue || 0) + 1,
      message: `${action} count incremented`,
    });

  } catch (error) {
    console.error('Error updating story metrics:', error);
    return NextResponse.json(
      { error: 'Failed to update metrics' },
      { status: 500 }
    );
  }
}
