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

    // Get project with scenes and images
    const projectService = new ProjectService(supabase);
    const project = await projectService.getProjectWithScenes(id, user.id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
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
