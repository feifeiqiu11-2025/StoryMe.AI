/**
 * API Route: Create Photo Import Project
 * POST /api/import-photos/create-project
 *
 * Creates an empty project for photo import (step 1 of chunked upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectRepository } from '@/lib/repositories/project.repository';

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
    const { title, storyContext, totalPages, illustrationStyle } = body as {
      title: string;
      storyContext?: string;
      totalPages: number;
      illustrationStyle?: 'pixar' | 'classic';
    };

    // Validate inputs
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    console.log(`📚 Creating photo storybook project: "${title}" (${totalPages} pages expected)`);

    // Create project
    const projectRepo = new ProjectRepository(supabase);
    const project = await projectRepo.create({
      user_id: user.id,
      title: title.trim(),
      description: storyContext || 'Created from photos',
      status: 'draft', // Will be set to completed after all uploads
      visibility: 'private',
      source_type: 'imported_photos',
      import_metadata: {
        story_context: storyContext,
        total_photos: totalPages,
        illustration_style: illustrationStyle || 'pixar',
        model_used: 'gpt-image-1',
      },
    } as any);

    console.log(`  Created project: ${project.id}`);

    return NextResponse.json({
      success: true,
      projectId: project.id,
    });

  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create project',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
