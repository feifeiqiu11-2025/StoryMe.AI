/**
 * API Route: Publish Story to KindleWood Kids App
 * POST /api/projects/[id]/publish-kids-app
 *
 * Publishes a story to KindleWood Kids App for selected children
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/projects/[id]/publish-kids-app
 * Publish a story to KindleWood Kids App for selected children
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request body
    const body = await request.json();
    const { childProfileIds, category = 'bedtime' } = body;

    if (!childProfileIds || !Array.isArray(childProfileIds) || childProfileIds.length === 0) {
      return NextResponse.json(
        { error: 'childProfileIds array is required' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Verify all child profiles belong to user
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id, name')
      .in('id', childProfileIds)
      .eq('parent_user_id', user.id);

    if (profilesError || !profiles || profiles.length !== childProfileIds.length) {
      return NextResponse.json(
        { error: 'Invalid child profile IDs' },
        { status: 400 }
      );
    }

    // 5. Validate project has all required content
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('id, scene_number')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (scenesError || !scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Project has no scenes' },
        { status: 400 }
      );
    }

    const sceneIds = scenes.map(s => s.id);

    // 6. Verify all scenes have images
    const { data: images, error: imagesError } = await supabase
      .from('generated_images')
      .select('scene_id')
      .in('scene_id', sceneIds);

    if (imagesError) {
      return NextResponse.json({ error: 'Error checking images' }, { status: 500 });
    }

    const scenesWithImages = new Set(images?.map(i => i.scene_id) || []);
    const missingImages = scenes.filter(s => !scenesWithImages.has(s.id));

    if (missingImages.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing images',
          missingScenes: missingImages.map(s => s.scene_number),
          message: `Please generate images for scene(s): ${missingImages.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 7. Verify all scenes have audio
    const { data: audioFiles, error: audioError } = await supabase
      .from('story_audio_pages')
      .select('scene_id')
      .in('scene_id', sceneIds)
      .not('audio_url', 'is', null);

    if (audioError) {
      return NextResponse.json({ error: 'Error checking audio' }, { status: 500 });
    }

    const scenesWithAudio = new Set(audioFiles?.map(a => a.scene_id) || []);
    const missingAudio = scenes.filter(s => !scenesWithAudio.has(s.id));

    if (missingAudio.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing audio',
          missingScenes: missingAudio.map(s => s.scene_number),
          message: `Please generate audio for scene(s): ${missingAudio.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 7a. Fetch quiz questions (optional - story might not have quiz)
    const { data: quizQuestions, error: quizError } = await supabase
      .from('quiz_questions')
      .select('id, question_order, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
      .eq('project_id', projectId)
      .order('question_order', { ascending: true });

    if (quizError) {
      console.error('Error fetching quiz questions:', quizError);
      // Don't fail publish if quiz fetch fails - quiz is optional
    }

    const hasQuiz = quizQuestions && quizQuestions.length > 0;

    // 7b. If story has quiz, verify quiz audio exists
    if (hasQuiz) {
      const quizQuestionIds = quizQuestions.map(q => q.id);

      // Check for quiz transition audio
      const { data: quizTransitionAudio } = await supabase
        .from('story_audio_pages')
        .select('id, audio_url')
        .eq('project_id', projectId)
        .eq('page_type', 'quiz_transition')
        .not('audio_url', 'is', null)
        .maybeSingle();

      // Check for quiz question audio
      const { data: quizQuestionAudio } = await supabase
        .from('story_audio_pages')
        .select('quiz_question_id, audio_url')
        .in('quiz_question_id', quizQuestionIds)
        .eq('page_type', 'quiz_question')
        .not('audio_url', 'is', null);

      const questionsWithAudio = new Set(quizQuestionAudio?.map(a => a.quiz_question_id) || []);
      const missingQuizAudio = quizQuestions.filter(q => !questionsWithAudio.has(q.id));

      if (!quizTransitionAudio || missingQuizAudio.length > 0) {
        return NextResponse.json(
          {
            error: 'Quiz is missing audio',
            details: {
              hasTransitionAudio: !!quizTransitionAudio,
              totalQuizQuestions: quizQuestions.length,
              questionsWithAudio: questionsWithAudio.size,
              missingAudioForQuestions: missingQuizAudio.map(q => q.question_order),
            },
            message: 'Please generate audio for the story. The quiz needs audio narration for all questions and the transition.'
          },
          { status: 400 }
        );
      }

      console.log(`✅ Quiz audio verified: transition + ${quizQuestions.length} questions`);
    }

    // 8. Create or update publication record
    const { data: publication, error: pubError } = await supabase
      .from('publications')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        platform: 'kindlewood_app',
        title: project.title,
        author: user.email || 'Unknown',
        description: project.description,
        cover_image_url: project.coverImageUrl || project.cover_image_url,
        guid: `kindlewood-app-${projectId}`,
        status: 'live',
        published_at: new Date().toISOString(),
        live_at: new Date().toISOString(),
        platform_metadata: {
          category: category,
          language: 'en',
          child_count: childProfileIds.length,
          scene_count: scenes.length,
          has_quiz: hasQuiz,
          quiz_question_count: hasQuiz ? quizQuestions.length : 0,
          reading_level: project.reading_level,
          story_tone: project.story_tone,
        },
      }, {
        onConflict: 'project_id,platform',
      })
      .select()
      .single();

    if (pubError) {
      console.error('Error creating publication:', pubError);
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    // 9. Add publication targets for each child
    const targets = childProfileIds.map((childId: string) => ({
      publication_id: publication.id,
      target_type: 'child_profile',
      target_id: childId,
      is_active: true,
      target_metadata: {
        category: category,
      },
    }));

    const { data: insertedTargets, error: targetsError } = await supabase
      .from('publication_targets')
      .upsert(targets, {
        onConflict: 'publication_id,target_id',
      })
      .select();

    if (targetsError) {
      console.error('Error creating publication targets:', targetsError);
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // 10. Return success response
    const quizMessage = hasQuiz ? ` (includes ${quizQuestions.length} quiz questions)` : '';
    return NextResponse.json({
      success: true,
      publication,
      targets: insertedTargets,
      publishedTo: profiles.map(p => p.name),
      hasQuiz,
      quizQuestionCount: hasQuiz ? quizQuestions.length : 0,
      message: `"${project.title}"${quizMessage} published to ${insertedTargets?.length || 0} child profile(s): ${profiles.map(p => p.name).join(', ')}`,
    });

  } catch (error: any) {
    console.error('Error publishing to Kids App:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/publish-kids-app
 * Check if a story is published to Kids App and get details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get publication record with targets
    const { data: publication, error } = await supabase
      .from('publications')
      .select(`
        *,
        publication_targets!inner(
          id,
          target_id,
          is_active,
          added_at
        )
      `)
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Error fetching publication:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!publication) {
      return NextResponse.json({
        isPublished: false,
        status: 'not_published',
        publishedTo: [],
      });
    }

    // Get child profile names
    const targetIds = publication.publication_targets
      .filter((t: any) => t.is_active)
      .map((t: any) => t.target_id);

    let childProfiles: any[] = [];
    if (targetIds.length > 0) {
      const { data: profiles } = await supabase
        .from('child_profiles')
        .select('id, name')
        .in('id', targetIds);
      childProfiles = profiles || [];
    }

    const activeTargets = publication.publication_targets.filter((t: any) => t.is_active);

    // Extract quiz info from platform_metadata
    const metadata = publication.platform_metadata || {};
    const hasQuiz = metadata.has_quiz || false;
    const quizQuestionCount = metadata.quiz_question_count || 0;

    return NextResponse.json({
      isPublished: publication.status === 'live' && activeTargets.length > 0,
      status: publication.status,
      publishedAt: publication.published_at,
      publishedTo: activeTargets.map((t: any) => {
        const profile = childProfiles.find(p => p.id === t.target_id);
        return {
          childId: t.target_id,
          childName: profile?.name || 'Unknown',
          publishedAt: t.added_at,
        };
      }),
      hasQuiz,
      quizQuestionCount,
      publication,
    });

  } catch (error: any) {
    console.error('Error checking publish status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/publish-kids-app
 * Unpublish a story from Kids App
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get publication
    const { data: publication } = await supabase
      .from('publications')
      .select('id')
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .single();

    if (!publication) {
      return NextResponse.json(
        { error: 'Publication not found' },
        { status: 404 }
      );
    }

    // Soft delete - set is_active to false for all targets
    const { error: targetsError } = await supabase
      .from('publication_targets')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('publication_id', publication.id);

    if (targetsError) {
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // Update publication status
    const { error: pubError } = await supabase
      .from('publications')
      .update({
        status: 'unpublished',
        unpublished_at: new Date().toISOString(),
      })
      .eq('id', publication.id);

    if (pubError) {
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Story unpublished from Kids App',
    });

  } catch (error: any) {
    console.error('Error unpublishing:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
