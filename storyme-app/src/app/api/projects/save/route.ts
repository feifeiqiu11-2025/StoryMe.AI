/**
 * API Route: Save Completed Story
 * POST /api/projects/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';
import { checkImageLimit } from '@/lib/middleware/checkImageLimit';

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
    const {
      title,
      description,
      authorName,
      authorAge,
      coverImageUrl,
      originalScript,
      readingLevel,
      storyTone,
      characterIds,
      scenes,
      visibility = 'private' // DEFAULT to private for safety
    } = body;

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

    // Validate visibility value
    if (visibility && visibility !== 'private' && visibility !== 'public') {
      return NextResponse.json(
        { error: 'Invalid visibility value. Must be "private" or "public"' },
        { status: 400 }
      );
    }

    // CHECK IMAGE LIMIT - verify user has enough quota for all scenes
    const imageCount = scenes.length;
    const limitCheck = await checkImageLimit(user.id);

    if (!limitCheck.allowed) {
      if (limitCheck.trialExpired) {
        return NextResponse.json({
          error: 'Trial expired',
          message: 'Your 7-day trial has expired. Please upgrade to continue creating stories.',
          trialExpired: true
        }, { status: 403 });
      }

      return NextResponse.json({
        error: 'Image limit reached',
        message: `You've used all ${limitCheck.limit} trial images. Please upgrade to continue.`,
        usage: {
          count: limitCheck.count,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining
        }
      }, { status: 403 });
    }

    // Check if user has enough remaining quota for this story
    if (limitCheck.remaining < imageCount && !limitCheck.isPremium) {
      return NextResponse.json({
        error: 'Insufficient image quota',
        message: `This story requires ${imageCount} images, but you only have ${limitCheck.remaining} remaining. Please upgrade or reduce the number of scenes.`,
        usage: {
          count: limitCheck.count,
          limit: limitCheck.limit,
          remaining: limitCheck.remaining,
          required: imageCount
        }
      }, { status: 403 });
    }

    // Check if this is user's first completed story (for feedback prompt)
    const { count: completedCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'completed');

    const isFirstStory = (completedCount || 0) === 0;

    // Check if user has already given feedback
    const { data: feedbackData } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', user.id)
      .single();

    const shouldShowFeedbackModal = isFirstStory && !feedbackData;

    // Save story
    const projectService = new ProjectService(supabase);
    const project = await projectService.saveCompletedStory(user.id, {
      title: title.trim(),
      description: description?.trim(),
      authorName: authorName?.trim(),
      authorAge: authorAge,
      coverImageUrl: coverImageUrl,
      originalScript,
      readingLevel: readingLevel,
      storyTone: storyTone,
      visibility: visibility as 'private' | 'public', // NEW: Privacy control (defaults to private)
      characterIds,
      scenes,
    });

    return NextResponse.json({
      success: true,
      project,
      message: 'Story saved successfully!',
      showFeedbackModal: shouldShowFeedbackModal, // NEW: Prompt for feedback after first story
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
