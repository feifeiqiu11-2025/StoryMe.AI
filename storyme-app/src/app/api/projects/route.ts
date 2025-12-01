/**
 * API Route: Projects (List all user's projects)
 * GET /api/projects
 *
 * Query params:
 * - limit: number (default: 12)
 * - offset: number (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';

const DEFAULT_LIMIT = 10; // Reduced for faster initial load

export async function GET(request: NextRequest) {
  try {
    // Parse pagination params from URL
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get projects for user with pagination
    const projectService = new ProjectService(supabase);
    const { projects, total } = await projectService.getUserProjects(user.id, { limit, offset });

    return NextResponse.json({
      success: true,
      projects,
      total,
      count: projects.length,
      limit,
      offset,
      hasMore: offset + projects.length < total,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
      },
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
