/**
 * Public Stories API
 * GET /api/stories/public - Get public stories for landing page and gallery
 * No authentication required
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20'); // Changed default to 20
    const offset = parseInt(searchParams.get('offset') || '0');
    const featured = searchParams.get('featured') === 'true';
    const sortBy = searchParams.get('sortBy') || 'recent'; // 'popular' or 'recent'
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || []; // NEW: Tag filtering
    const search = searchParams.get('search') || ''; // NEW: Search query

    // Validate params
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for public display
    const supabase = createServiceRoleClient();

    // Build query for public stories with scenes, images, and tags
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
        author_name,
        author_age,
        cover_image_url,
        scenes (
          id,
          scene_number,
          description,
          caption,
          generated_images (
            id,
            image_url
          )
        ),
        project_tags (
          tag_id,
          story_tags (
            id,
            name,
            slug,
            icon,
            category,
            parent_id,
            is_leaf,
            display_order
          )
        )
      `, { count: 'exact' }) // Get total count for pagination
      .eq('visibility', 'public')
      .eq('status', 'completed');

    // Apply search filter (title or description)
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,author_name.ilike.%${search}%`);
    }

    // If featured=true, prioritize featured stories
    if (featured) {
      query = query.order('featured', { ascending: false });
    }

    // Order by sortBy parameter: 'popular' = view_count, 'recent' = published_at
    if (sortBy === 'popular') {
      query = query
        .order('view_count', { ascending: false })
        .order('published_at', { ascending: false });
    } else {
      // Sort by recent (published_at descending)
      query = query.order('published_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: projects, error, count } = await query;

    if (error) {
      console.error('Error fetching public stories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch public stories' },
        { status: 500 }
      );
    }

    // Transform data to include only first image per scene and tags
    let formattedProjects = projects.map((project: any) => ({
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
      authorName: project.author_name,
      authorAge: project.author_age,
      coverImageUrl: project.cover_image_url,
      scenes: project.scenes?.map((scene: any) => ({
        id: scene.id,
        sceneNumber: scene.scene_number,
        description: scene.description,
        caption: scene.caption,
        imageUrl: scene.generated_images?.[0]?.image_url || null,
      })) || [],
      tags: project.project_tags?.map((pt: any) => ({
        id: pt.story_tags.id,
        name: pt.story_tags.name,
        slug: pt.story_tags.slug,
        icon: pt.story_tags.icon,
        category: pt.story_tags.category,
        parentId: pt.story_tags.parent_id,
        isLeaf: pt.story_tags.is_leaf ?? true,
        displayOrder: pt.story_tags.display_order,
      })) || [],
    }));

    // Filter by tags if provided (client-side filtering)
    // Support filtering by both tag slug AND category
    if (tags.length > 0) {
      formattedProjects = formattedProjects.filter((project: any) => {
        const projectTagSlugs = project.tags.map((t: any) => t.slug);
        const projectTagCategories = project.tags.map((t: any) => t.category);

        // Project must have at least one of the requested tags (by slug or category)
        return tags.some(tag =>
          projectTagSlugs.includes(tag) || projectTagCategories.includes(tag)
        );
      });
    }

    // Calculate pagination metadata
    const totalCount = count || 0;
    const currentPage = Math.floor(offset / limit) + 1;
    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      stories: formattedProjects, // Changed from 'projects' to 'stories' for consistency
      totalCount,
      currentPage,
      totalPages,
      offset,
      limit,
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('Error in public stories API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    );
  }
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
