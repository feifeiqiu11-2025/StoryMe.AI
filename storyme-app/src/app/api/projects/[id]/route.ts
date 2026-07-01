/**
 * API Route: Single Project
 * GET /api/projects/[id] - Get project with all details
 * DELETE /api/projects/[id] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get project with scenes, images, and characters
    const projectService = new ProjectService(supabase);
    const project = await projectService.getProjectFull(id, user.id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Per-image edit counts for the persistent edit cap UI. Stored on the project in
    // one JSONB keyed by sceneNumber ("0" = cover, "1".."N" = scenes) so they survive
    // the save flow's scene delete+recreate. RLS already scoped to the owner.
    const { data: projRow } = await supabase
      .from('projects')
      .select('edit_counts')
      .eq('id', id)
      .maybeSingle();
    const rawCounts = (projRow?.edit_counts as Record<string, number> | null) || {};
    const editCounts = {
      cover: rawCounts['0'] ?? 0,
      scenes: Object.fromEntries(
        Object.entries(rawCounts)
          .filter(([k]) => k !== '0')
          .map(([k, v]) => [Number(k), v])
      ) as Record<number, number>,
    };

    return NextResponse.json({
      success: true,
      project,
      editCounts,
    });

  } catch (error) {
    console.error('Error fetching project:', error);

    if (error instanceof Error) {
      // Handle authorization errors
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { visibility, status } = body;

    // Must provide at least one field to update
    if (!visibility && !status) {
      return NextResponse.json(
        { error: 'No update fields provided' },
        { status: 400 }
      );
    }

    // Validate visibility if provided
    if (visibility && visibility !== 'private' && visibility !== 'public') {
      return NextResponse.json(
        { error: 'Invalid visibility value. Must be "private" or "public"' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projectService = new ProjectService(supabase);

    // Handle visibility update
    if (visibility) {
      // Reject visibility changes for draft projects
      const { data: project } = await supabase
        .from('projects')
        .select('status')
        .eq('id', id)
        .single();

      if (project?.status === 'draft') {
        return NextResponse.json(
          { error: 'Draft stories cannot be made public. Complete the story first.' },
          { status: 400 }
        );
      }

      await projectService.updateProject(id, user.id, { visibility });
    }

    // Handle status revert — used by the "Edit" button on the story detail page
    // to move a completed story back into the create-flow's resume-draft path.
    // Only 'draft' is allowed as a target value here; other status transitions are
    // not exposed through this endpoint. Ownership is enforced by projectService
    // (updateProject / buildDraftMetadataFromCompletedProject reject other users' projects).
    if (status) {
      if (status !== 'draft') {
        return NextResponse.json(
          { error: 'Only status="draft" is supported' },
          { status: 400 }
        );
      }

      // Defense in depth: the client guard already prevents this, but reject server-side
      // too so a public story can't end up with status='draft' via direct API call.
      const { data: currentProject } = await supabase
        .from('projects')
        .select('visibility')
        .eq('id', id)
        .single();
      if (currentProject?.visibility === 'public') {
        return NextResponse.json(
          { error: 'Make the story private first, then revert to draft.' },
          { status: 400 }
        );
      }

      // Rebuild a draft_metadata blob from the relational tables so the /create page's
      // resume effect (which reads everything from draft_metadata) can re-hydrate state.
      // Resume code path is not modified.
      const rebuiltMetadata = await projectService.buildDraftMetadataFromCompletedProject(
        id,
        user.id
      );
      await projectService.updateProject(id, user.id, {
        status: 'draft',
        draft_metadata: rebuiltMetadata,
      } as any);

      // This story was completed before being reverted for editing. Mark it as
      // already-completed (if not already) so the re-save through
      // /api/projects/save is treated as an edit — not a new story — and isn't
      // blocked by or charged against the monthly story quota. Belt-and-braces
      // for stories the backfill migration couldn't detect.
      await supabase
        .from('projects')
        .update({ first_completed_at: new Date().toISOString() })
        .eq('id', id)
        .is('first_completed_at', null);
    }

    return NextResponse.json({
      success: true,
      message: status
        ? 'Story reverted to draft for editing'
        : visibility ? `Story is now ${visibility}` : 'Canvas state saved',
      ...(visibility && { visibility }),
      ...(status && { status }),
    });

  } catch (error) {
    console.error('Error updating project visibility:', error);

    if (error instanceof Error) {
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update visibility' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('[DELETE /api/projects/[id]] Starting delete request...');
    const { id } = await params;
    console.log(`[DELETE /api/projects/[id]] Project ID: ${id}`);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.error('[DELETE /api/projects/[id]] Auth error:', authError);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log(`[DELETE /api/projects/[id]] User ID: ${user.id}`);

    // Delete project
    const projectService = new ProjectService(supabase);
    console.log('[DELETE /api/projects/[id]] Calling projectService.deleteProject...');
    await projectService.deleteProject(id, user.id);
    console.log('[DELETE /api/projects/[id]] Delete successful!');

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });

  } catch (error) {
    console.error('[DELETE /api/projects/[id]] Error deleting project:', error);

    if (error instanceof Error) {
      console.error('[DELETE /api/projects/[id]] Error message:', error.message);
      console.error('[DELETE /api/projects/[id]] Error stack:', error.stack);

      // Handle authorization errors
      if (error.message.includes('Unauthorized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }

      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
