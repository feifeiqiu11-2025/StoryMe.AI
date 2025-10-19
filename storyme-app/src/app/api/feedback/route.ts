/**
 * API Route: User Feedback
 * POST /api/feedback - Submit user feedback and award bonus images
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { rating, feedbackText, isPublic, displayName, projectId } = body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Check if user has already given feedback
    const { data: existingFeedback } = await supabase
      .from('user_feedback')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (existingFeedback) {
      return NextResponse.json(
        { error: 'You have already submitted feedback' },
        { status: 400 }
      );
    }

    // Insert feedback
    const { error: feedbackError } = await supabase
      .from('user_feedback')
      .insert([{
        user_id: user.id,
        project_id: projectId || null,
        rating,
        feedback_text: feedbackText || null,
        is_public: isPublic || false,
        display_name: (isPublic && displayName) ? displayName : null,
      }]);

    if (feedbackError) {
      console.error('Error inserting feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // Award bonus images (+5)
    const FEEDBACK_BONUS = 5;

    const { data: userData, error: userFetchError } = await supabase
      .from('users')
      .select('images_limit, has_given_feedback, feedback_bonus_awarded')
      .eq('id', user.id)
      .single();

    if (userFetchError) {
      console.error('Error fetching user data:', userFetchError);
      // Feedback was saved, but bonus failed - not critical
    } else if (!userData.feedback_bonus_awarded) {
      // Award bonus only once
      const { error: updateError } = await supabase
        .from('users')
        .update({
          images_limit: (userData.images_limit || 50) + FEEDBACK_BONUS,
          has_given_feedback: true,
          feedback_bonus_awarded: true,
        })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error awarding bonus images:', updateError);
        // Feedback was saved, but bonus failed - not critical
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Thank you for your feedback!',
      bonusAwarded: FEEDBACK_BONUS,
    });

  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint to check if user has given feedback
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if feedback exists
    const { data: feedback, error: feedbackError } = await supabase
      .from('user_feedback')
      .select('id, rating, created_at')
      .eq('user_id', user.id)
      .single();

    if (feedbackError && feedbackError.code !== 'PGRST116') {
      console.error('Error fetching feedback:', feedbackError);
      return NextResponse.json(
        { error: 'Failed to check feedback status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasGivenFeedback: !!feedback,
      feedback: feedback || null,
    });

  } catch (error) {
    console.error('Error in feedback GET API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
