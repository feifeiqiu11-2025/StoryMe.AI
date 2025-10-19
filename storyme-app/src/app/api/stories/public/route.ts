/**
 * Public Stories API
 * GET /api/stories/public - Get public stories for landing page and gallery
 * No authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');
    const featured = searchParams.get('featured') === 'true';

    // Validate params
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Build query for public stories with scenes and images
    let query = supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        visibility,
        featured,
        view_count,
        like_count,
        share_count,
        published_at,
        created_at,
        scenes (
          id,
          scene_number,
          description,
          caption,
          generated_images (
            id,
            image_url
          )
        )
      `)
      .eq('visibility', 'public')
      .eq('status', 'completed')
      .range(offset, offset + limit - 1);

    // If featured=true, prioritize featured stories
    if (featured) {
      query = query.order('featured', { ascending: false });
    }

    // Order by view count (top stories first), then by published date
    query = query
      .order('view_count', { ascending: false })
      .order('published_at', { ascending: false });

    const { data: projects, error } = await query;

    if (error) {
      console.error('Error fetching public stories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch public stories' },
        { status: 500 }
      );
    }

    // Transform data to include only first image per scene
    const formattedProjects = projects.map((project: any) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      visibility: project.visibility,
      featured: project.featured,
      viewCount: project.view_count,
      likeCount: project.like_count,
      shareCount: project.share_count,
      publishedAt: project.published_at,
      createdAt: project.created_at,
      scenes: project.scenes?.map((scene: any) => ({
        id: scene.id,
        sceneNumber: scene.scene_number,
        description: scene.description,
        caption: scene.caption,
        imageUrl: scene.generated_images?.[0]?.image_url || null,
      })) || [],
    }));

    return NextResponse.json({
      success: true,
      projects: formattedProjects,
      count: formattedProjects.length,
      offset,
      limit,
    });

  } catch (error) {
    console.error('Error in public stories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
