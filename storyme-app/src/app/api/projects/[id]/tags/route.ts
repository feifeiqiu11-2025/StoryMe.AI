/**
 * Project Tags API
 * POST /api/projects/[id]/tags - Update tags for a project
 * DELETE /api/projects/[id]/tags - Remove all tags from a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const projectId = params.id;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const { tagIds } = await request.json();

    if (!Array.isArray(tagIds)) {
      return NextResponse.json(
        { error: 'tagIds must be an array' },
        { status: 400 }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - you do not own this project' },
        { status: 403 }
      );
    }

    // Delete existing tags for this project
    const { error: deleteError } = await supabase
      .from('project_tags')
      .delete()
      .eq('project_id', projectId);

    if (deleteError) {
      console.error('Error deleting old tags:', deleteError);
      return NextResponse.json(
        { error: 'Failed to update tags' },
        { status: 500 }
      );
    }

    // If no tags provided, we're done (user removed all tags)
    if (tagIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tags removed',
        tagCount: 0,
      });
    }

    // Insert new tags
    const projectTags = tagIds.map(tagId => ({
      project_id: projectId,
      tag_id: tagId,
    }));

    const { error: insertError } = await supabase
      .from('project_tags')
      .insert(projectTags);

    if (insertError) {
      console.error('Error inserting new tags:', insertError);
      return NextResponse.json(
        { error: 'Failed to add tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tags updated successfully',
      tagCount: tagIds.length,
    });

  } catch (error) {
    console.error('Project tags API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const projectId = params.id;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('user_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete all tags
    const { error: deleteError } = await supabase
      .from('project_tags')
      .delete()
      .eq('project_id', projectId);

    if (deleteError) {
      console.error('Error deleting tags:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'All tags removed',
    });

  } catch (error) {
    console.error('Delete tags API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
