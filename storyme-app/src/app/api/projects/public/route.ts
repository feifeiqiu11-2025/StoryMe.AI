/**
 * API Route: Public Projects (for landing page gallery)
 * GET /api/projects/public
 * Returns all saved projects for display on the landing page
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProjectRepository } from '@/lib/repositories/project.repository';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { projectWithScenesToDTO } from '@/lib/domain/converters';

export async function GET(request: NextRequest) {
  try {
    // Use service role client to bypass RLS for public display
    // In production, would filter by is_public flag
    const supabase = createServiceRoleClient();
    const projectRepo = new ProjectRepository(supabase);

    // Get all projects (POC mode - in production would filter by is_public flag)
    const allProjects = await projectRepo.findAllWithScenes();

    // Limit to most recent 6 projects for landing page
    const recentProjects = allProjects
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6)
      .map(projectWithScenesToDTO);

    return NextResponse.json({
      success: true,
      projects: recentProjects,
      count: recentProjects.length,
    });

  } catch (error) {
    console.error('Error fetching public projects:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to fetch public projects' },
      { status: 500 }
    );
  }
}
