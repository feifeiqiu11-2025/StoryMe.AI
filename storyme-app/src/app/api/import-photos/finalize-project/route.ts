/**
 * API Route: Finalize Photo Import Project
 * POST /api/import-photos/finalize-project
 *
 * Marks project as completed (step 3 of chunked upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Verify project exists and belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
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

    // Count scenes created
    const { count: sceneCount } = await supabase
      .from('scenes')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId);

    // Update project status to completed
    const { error: updateError } = await supabase
      .from('projects')
      .update({ status: 'completed' })
      .eq('id', projectId);

    if (updateError) {
      console.error('Failed to update project status:', updateError);
      return NextResponse.json(
        { error: 'Failed to finalize project' },
        { status: 500 }
      );
    }

    console.log(`✓ Finalized photo storybook ${projectId} with ${sceneCount} scenes`);

    return NextResponse.json({
      success: true,
      projectId,
      sceneCount,
    });

  } catch (error) {
    console.error('Finalize project error:', error);
    return NextResponse.json(
      {
        error: 'Failed to finalize project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
