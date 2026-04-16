/**
 * API Route: Save Completed Story
 * POST /api/projects/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';
// Image limit check disabled — story creation limit is the gatekeeper now
// import { checkImageLimit } from '@/lib/middleware/checkImageLimit';
import { checkStoryCreationLimit, incrementStoryCount } from '@/lib/subscription/middleware';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    // Supports both cookie-based and Bearer token auth
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // CHECK STORY CREATION LIMIT - Phase 2A subscription system
    const subscriptionStatus = await checkStoryCreationLimit(user.id);

    if (!subscriptionStatus.canCreate) {
      return NextResponse.json({
        error: 'Story limit reached',
        message: subscriptionStatus.reason,
        subscription: {
          tier: subscriptionStatus.tier,
          status: subscriptionStatus.status,
          storiesUsed: subscriptionStatus.storiesUsed,
          storiesLimit: subscriptionStatus.storiesLimit,
          trialEndsAt: subscriptionStatus.trialEndsAt,
        },
        upgradeRequired: true,
      }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const {
      projectId,        // Optional: draft→completed transition
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
      quizData, // NEW: Optional quiz questions
      visibility = 'private', // DEFAULT to private for safety
      language = 'en', // NEW: Language for the story (en or zh)
      secondaryLanguage = null, // Secondary language for bilingual captions (e.g., 'zh', 'ko')
    } = body;

    // If projectId provided, verify it's a draft owned by this user
    if (projectId) {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id, status, user_id')
        .eq('id', projectId)
        .single();

      if (!existingProject) {
        return NextResponse.json(
          { error: 'Draft project not found' },
          { status: 404 }
        );
      }

      if (existingProject.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized: Project does not belong to you' },
          { status: 403 }
        );
      }

      if (existingProject.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft projects can be completed via this endpoint' },
          { status: 400 }
        );
      }
    }

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
        { error: 'At least one scene is required' },
        { status: 400 }
      );
    }

    // Validate scene data (imageUrl is optional — failed scenes may not have one)
    for (const scene of scenes) {
      if (!scene.description || typeof scene.sceneNumber !== 'number') {
        return NextResponse.json(
          { error: 'Invalid scene data: each scene must have description and sceneNumber' },
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

    // IMAGE LIMIT CHECK — disabled (story creation limit is the gatekeeper now)
    // The daily rate limit in generate-images route still protects against abuse.

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

    // Save story (supports both new creation and draft→completed transition)
    const projectService = new ProjectService(supabase);
    const project = await projectService.saveCompletedStory(user.id, {
      projectId,         // If provided, transitions draft→completed
      title: title.trim(),
      description: description?.trim(),
      authorName: authorName?.trim(),
      authorAge: authorAge,
      coverImageUrl: coverImageUrl,
      originalScript,
      readingLevel: readingLevel,
      storyTone: storyTone,
      visibility: visibility as 'private' | 'public',
      language: language as 'en' | 'zh',
      secondaryLanguage,
      characterIds,
      scenes,
      quizData,
    });

    // INCREMENT STORY COUNT - Phase 2A subscription system
    // This updates the user's monthly story counter and usage tracking
    try {
      await incrementStoryCount(user.id);
    } catch (countError) {
      // Log error but don't fail the request - story was already saved
      console.error('Failed to increment story count:', countError);
    }

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
