/**
 * API Route: GET /api/v1/chapter-books/[id]/public
 *
 * Anonymous-friendly read endpoint for chapter books. Mirrors the access
 * gate used by /api/stories/public/[id] — public rows are open, unlisted
 * rows require the matching ?token=, anything else returns 404 (we use 404
 * not 403 to avoid leaking the existence of private rows).
 *
 * Returns the Tiptap doc so the reader can render pages directly.
 *
 * Principle 1 (Security): service-role read but explicit visibility gate.
 *   Owner-only fields (share_token) are not echoed back to anonymous
 *   readers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tokenParam = request.nextUrl.searchParams.get('token');

    const supabase = createServiceRoleClient();
    const { data: project, error } = await supabase
      .from('projects')
      .select('id, project_type, title, description, visibility, share_token, cover_image_url, author_name, author_age, view_count, published_at, created_at, canvas_state')
      .eq('id', id)
      .single<{
        id: string;
        project_type: string | null;
        title: string | null;
        description: string | null;
        visibility: string | null;
        share_token: string | null;
        cover_image_url: string | null;
        author_name: string | null;
        author_age: number | null;
        view_count: number | null;
        published_at: string | null;
        created_at: string;
        canvas_state: Record<string, unknown> | null;
      }>();

    if (error || !project) {
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }
    if (project.project_type !== 'chapter_book') {
      // Don't leak project_type — 404 keeps id space opaque.
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }

    const isPublic = project.visibility === 'public';
    const isUnlistedWithToken =
      project.visibility === 'unlisted' &&
      !!project.share_token &&
      !!tokenParam &&
      tokenParam === project.share_token;

    if (!isPublic && !isUnlistedWithToken) {
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }

    // View count is tracked separately via POST /api/stories/public/[id]
    // with { action: 'view' }. This endpoint is read-only — no
    // auto-increment here, so CDN caching of detail reads doesn't
    // suppress counts. See API_MOBILE.md for the client contract.

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        projectType: project.project_type,
        title: project.title,
        description: project.description,
        visibility: project.visibility,
        coverImageUrl: project.cover_image_url,
        authorName: project.author_name,
        authorAge: project.author_age,
        viewCount: project.view_count,
        publishedAt: project.published_at,
        createdAt: project.created_at,
        editorDoc: project.canvas_state,
      },
    });
  } catch (error) {
    console.error('public chapter book read error:', error);
    return NextResponse.json({ error: 'Failed to load chapter book' }, { status: 500 });
  }
}
