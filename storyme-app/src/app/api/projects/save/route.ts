/**
 * API Route: Save Completed Story
 * POST /api/projects/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { title, description, originalScript, characterIds, scenes } = body;

    // Validate required fields
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!originalScript || !originalScript.trim()) {
      return NextResponse.json(
        { error: 'Original script is required' },
        { status: 400 }
      );
    }

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one character is required' },
        { status: 400 }
      );
    }

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scene with image is required' },
        { status: 400 }
      );
    }

    // Validate scene data
    for (const scene of scenes) {
      if (!scene.imageUrl || !scene.description || typeof scene.sceneNumber !== 'number') {
        return NextResponse.json(
          { error: 'Invalid scene data: each scene must have imageUrl, description, and sceneNumber' },
          { status: 400 }
        );
      }
    }

    // Save story
    const projectService = new ProjectService(supabase);
    const project = await projectService.saveCompletedStory(user.id, {
      title: title.trim(),
      description: description?.trim(),
      originalScript,
      characterIds,
      scenes,
    });

    return NextResponse.json({
      success: true,
      project,
      message: 'Story saved successfully!',
    });

  } catch (error) {
    console.error('Error saving story:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save story' },
      { status: 500 }
    );
  }
}
