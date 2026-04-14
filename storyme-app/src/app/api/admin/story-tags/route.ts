/**
 * Admin API: Assign tags to any story (bypasses RLS ownership check)
 * PUT /api/admin/story-tags
 *
 * Replaces all tags on a story with the provided list.
 * Uses service role client so admin can tag stories they don't own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isAdminEmail } from '@/lib/auth/isAdmin';

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, tagIds } = body;

    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json({ error: 'projectId (string) is required' }, { status: 400 });
    }

    if (!Array.isArray(tagIds)) {
      return NextResponse.json({ error: 'tagIds (array) is required' }, { status: 400 });
    }

    const adminClient = createServiceRoleClient();

    // Verify the project exists and is public
    const { data: project, error: projectError } = await adminClient
      .from('projects')
      .select('id, visibility')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete existing tags
    const { error: deleteError } = await adminClient
      .from('project_tags')
      .delete()
      .eq('project_id', projectId);

    if (deleteError) {
      console.error('Error removing existing tags:', deleteError);
      return NextResponse.json({ error: 'Failed to update tags' }, { status: 500 });
    }

    // Insert new tags if any
    if (tagIds.length > 0) {
      const rows = tagIds.map((tagId: string) => ({
        project_id: projectId,
        tag_id: tagId,
      }));

      const { error: insertError } = await adminClient
        .from('project_tags')
        .insert(rows);

      if (insertError) {
        console.error('Error inserting tags:', insertError);
        return NextResponse.json({ error: 'Failed to assign tags' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, tagCount: tagIds.length });
  } catch (err) {
    console.error('Unexpected error in admin story-tags API:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
