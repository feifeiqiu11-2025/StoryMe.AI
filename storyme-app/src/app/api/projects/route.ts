/**
 * API Route: Projects (List all user's projects)
 * GET /api/projects
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all projects for user
    const projectService = new ProjectService(supabase);
    const projects = await projectService.getUserProjects(user.id);

    return NextResponse.json({
      success: true,
      projects,
      count: projects.length,
    });

  } catch (error) {
    console.error('Error fetching projects:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}
