/**
 * Public Stories API
 * GET /api/stories/public - Get public stories for landing page and gallery
 * No authentication required
 *
 * IMPORTANT: Tag filtering is done at the database level BEFORE pagination
 * to ensure correct results and accurate counts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '24');
    const offset = parseInt(searchParams.get('offset') || '0');
    const featured = searchParams.get('featured') === 'true';
    const featuredOnly = searchParams.get('featuredOnly') === 'true';
    const featuredWithBackfill = searchParams.get('featuredWithBackfill') === 'true';
    // Chapter-stories-only mode: returns chapter books + picture books
    // explicitly tagged "chapterbook" (kids think of multi-chapter
    // picture-book series as chapter books even though the project_type
    // is different). Powers the Chapter Stories row on the community feed.
    const chapterStoriesOnly = searchParams.get('chapterStoriesOnly') === 'true';
    const sortBy = searchParams.get('sortBy') || 'recent'; // 'popular' or 'recent'
    const tagSlugs = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const search = searchParams.get('search') || '';

    // Validate params
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: 'Limit must be between 1 and 100' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS for public display
    const supabase = createServiceRoleClient();

    // Step 1: If tags are provided, resolve them to project IDs at the database level
    // This ensures filtering happens BEFORE pagination
    let filteredProjectIds: string[] | null = null;

    if (tagSlugs.length > 0) {
      // First, get all matching tag IDs (by slug OR category)
      // For category matches, also include all child tags
      const { data: matchingTags, error: tagError } = await supabase
        .from('story_tags')
        .select('id, slug, category, is_leaf, parent_id')
        .or(tagSlugs.map(slug => `slug.eq.${slug},category.eq.${slug}`).join(','));

      if (tagError) {
        console.error('Error fetching tags:', tagError);
        return NextResponse.json(
          { error: 'Failed to fetch tags' },
          { status: 500 }
        );
      }

      if (!matchingTags || matchingTags.length === 0) {
        // No matching tags found - return empty result
        return NextResponse.json({
          success: true,
          stories: [],
          totalCount: 0,
          currentPage: 1,
          totalPages: 0,
          offset,
          limit,
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }

      // Collect all tag IDs that should match
      const tagIds = matchingTags.map(t => t.id);

      // Get project IDs that have any of these tags
      const { data: projectTags, error: ptError } = await supabase
        .from('project_tags')
        .select('project_id')
        .in('tag_id', tagIds);

      if (ptError) {
        console.error('Error fetching project tags:', ptError);
        return NextResponse.json(
          { error: 'Failed to fetch project tags' },
          { status: 500 }
        );
      }

      // Extract unique project IDs
      filteredProjectIds = [...new Set(projectTags?.map(pt => pt.project_id) || [])];

      if (filteredProjectIds.length === 0) {
        // No projects have these tags - return empty result
        return NextResponse.json({
          success: true,
          stories: [],
          totalCount: 0,
          currentPage: 1,
          totalPages: 0,
          offset,
          limit,
        }, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          },
        });
      }
    }

    // Step 1.4: Featured-only mode — used by the Community Stories featured carousel.
    // Returns only stories marked featured=true, ordered newest-first. No backfill.
    if (featuredOnly) {
      const { data: featuredStories, error: featuredError } = await supabase
        .from('projects')
        .select(`
          id, project_type, title, description, visibility, featured, view_count, like_count, share_count,
          published_at, created_at, author_name, author_age, cover_image_url,
          scenes (id, scene_number, description, caption, generated_images (id, image_url)),
          project_tags (tag_id, story_tags (id, name, slug, icon, category, parent_id, is_leaf, display_order))
        `)
        .eq('visibility', 'public')
        .eq('status', 'completed')
        .eq('featured', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (featuredError) {
        console.error('Error fetching featured-only stories:', featuredError);
        return NextResponse.json({ error: 'Failed to fetch featured stories' }, { status: 500 });
      }

      const formatted = (featuredStories || []).map((project: any) => ({
        id: project.id,
        projectType: project.project_type,
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

      return NextResponse.json({
        success: true,
        stories: formatted,
        totalCount: formatted.length,
        currentPage: 1,
        totalPages: 1,
        offset: 0,
        limit,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }

    // Step 1.5: Featured-with-backfill mode for HeroCarousel
    // Returns up to `limit` featured stories, backfilled with latest non-featured if needed
    if (featuredWithBackfill) {
      const selectFields = `
        id, project_type, title, description, visibility, featured, view_count, like_count, share_count,
        published_at, created_at, author_name, author_age, cover_image_url,
        scenes (id, scene_number, description, caption, generated_images (id, image_url)),
        project_tags (tag_id, story_tags (id, name, slug, icon, category, parent_id, is_leaf, display_order))
      `;

      // First: get featured stories (up to limit)
      const { data: featuredStories, error: featuredError } = await supabase
        .from('projects')
        .select(selectFields)
        .eq('visibility', 'public')
        .eq('status', 'completed')
        .eq('featured', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (featuredError) {
        console.error('Error fetching featured stories:', featuredError);
        return NextResponse.json({ error: 'Failed to fetch featured stories' }, { status: 500 });
      }

      let allStories = featuredStories || [];

      // Backfill with latest non-featured if we have fewer than limit
      if (allStories.length < limit) {
        const remaining = limit - allStories.length;
        const featuredIds = allStories.map((s: any) => s.id);

        let backfillQuery = supabase
          .from('projects')
          .select(selectFields)
          .eq('visibility', 'public')
          .eq('status', 'completed')
          .eq('featured', false)
          .order('published_at', { ascending: false })
          .limit(remaining);

        // Exclude already-fetched featured stories
        if (featuredIds.length > 0) {
          backfillQuery = backfillQuery.not('id', 'in', `(${featuredIds.join(',')})`);
        }

        const { data: backfillStories } = await backfillQuery;
        if (backfillStories) {
          allStories = [...allStories, ...backfillStories];
        }
      }

      const formatStory = (project: any) => ({
        id: project.id,
        projectType: project.project_type,
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
        })) || [],
      });

      return NextResponse.json({
        success: true,
        stories: allStories.map(formatStory),
        totalCount: allStories.length,
        currentPage: 1,
        totalPages: 1,
        offset: 0,
        limit,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }

    // Step 1.6: Chapter-stories-only mode — used by the Chapter Stories
    // row on the community feed. Returns the union of:
    //   (a) real chapter_book projects
    //   (b) picture_book projects tagged with story_tags.slug = 'chapterbook'
    // Sorted by published_at desc, paginated via offset/limit so the row
    // can lazy-load 6 at a time as the kid scrolls right.
    //
    // The merge happens in-memory rather than via Supabase .or() across
    // a join because that syntax is fragile. Both source lists are small
    // (only public + completed projects), so a merge + sort + slice is
    // fine here. Revisit if either side grows past ~500 rows.
    if (chapterStoriesOnly) {
      const selectFields = `
        id, project_type, title, description, visibility, featured, view_count, like_count, share_count,
        published_at, created_at, author_name, author_age, cover_image_url,
        scenes (id, scene_number, description, caption, generated_images (id, image_url)),
        project_tags (tag_id, story_tags (id, name, slug, icon, category, parent_id, is_leaf, display_order))
      `;

      // Branch (a): real chapter books.
      const chapterBooksQuery = supabase
        .from('projects')
        .select(selectFields)
        .eq('visibility', 'public')
        .eq('status', 'completed')
        .eq('project_type', 'chapter_book')
        .order('published_at', { ascending: false });

      // Branch (b): picture books with a "chapter book" tag. Resolve
      // the tag ids first, then look up project_ids in project_tags,
      // then fetch those projects. Could be done with a single join
      // but Supabase's JOIN+filter chain is touchy — two cheap queries
      // are more robust.
      //
      // We match any slug like 'chapter%book%' (case-insensitive) so
      // that user-created custom tag slugs (e.g. 'custom-chapterbook',
      // 'chapter-book', 'chapterbook') all flow through. If your DB
      // grows ambiguous chapter-like tags, tighten this filter.
      let taggedPictureBooks: any[] = [];
      const { data: chapterTagRows, error: chapterTagErr } = await supabase
        .from('story_tags')
        .select('id, slug')
        .ilike('slug', '%chapter%book%');

      if (chapterTagErr) {
        console.warn('Chapter tag lookup failed:', chapterTagErr);
      } else if (chapterTagRows && chapterTagRows.length > 0) {
        const chapterTagIds = chapterTagRows.map((t) => t.id);
        const { data: ptRows, error: ptErr } = await supabase
          .from('project_tags')
          .select('project_id')
          .in('tag_id', chapterTagIds);
        if (ptErr) {
          console.warn('Chapter tag project lookup failed:', ptErr);
        } else if (ptRows && ptRows.length > 0) {
          const projectIds = ptRows.map((r) => r.project_id);
          const { data: tagged, error: taggedErr } = await supabase
            .from('projects')
            .select(selectFields)
            .eq('visibility', 'public')
            .eq('status', 'completed')
            .eq('project_type', 'picture_book')
            .in('id', projectIds)
            .order('published_at', { ascending: false });
          if (taggedErr) {
            console.warn('Tagged picture-books fetch failed:', taggedErr);
          } else if (tagged) {
            taggedPictureBooks = tagged;
          }
        }
      }

      const { data: chapterBooks, error: chapterErr } = await chapterBooksQuery;
      if (chapterErr) {
        console.error('Chapter books fetch failed:', chapterErr);
        return NextResponse.json(
          { error: 'Failed to fetch chapter stories' },
          { status: 500 }
        );
      }

      // Merge + dedupe by id (a project could be both — we'd show it
      // once). Sort by published_at desc; null-published_at rows fall
      // to the bottom by created_at as a tiebreaker.
      const byId = new Map<string, any>();
      for (const row of [...(chapterBooks ?? []), ...taggedPictureBooks]) {
        if (!byId.has(row.id)) byId.set(row.id, row);
      }
      const merged = Array.from(byId.values()).sort((a, b) => {
        const ap = a.published_at ? Date.parse(a.published_at) : 0;
        const bp = b.published_at ? Date.parse(b.published_at) : 0;
        if (ap !== bp) return bp - ap;
        const ac = a.created_at ? Date.parse(a.created_at) : 0;
        const bc = b.created_at ? Date.parse(b.created_at) : 0;
        return bc - ac;
      });

      const totalCount = merged.length;
      const page = merged.slice(offset, offset + limit);

      const formatted = page.map((project: any) => ({
        id: project.id,
        projectType: project.project_type,
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

      return NextResponse.json({
        success: true,
        stories: formatted,
        totalCount,
        currentPage: Math.floor(offset / limit) + 1,
        totalPages: Math.max(1, Math.ceil(totalCount / limit)),
        offset,
        limit,
      }, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      });
    }

    // Step 2: Build the main query with tag filter applied at DB level
    let query = supabase
      .from('projects')
      .select(`
        id,
        project_type,
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
      `, { count: 'exact' })
      .eq('visibility', 'public')
      .eq('status', 'completed');

    // Apply tag filter at database level (BEFORE pagination)
    if (filteredProjectIds !== null) {
      query = query.in('id', filteredProjectIds);
    }

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

    // Apply pagination AFTER filtering
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
    const formattedProjects = projects.map((project: any) => ({
      id: project.id,
      projectType: project.project_type,
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

    // Calculate pagination metadata - count now reflects filtered results
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
