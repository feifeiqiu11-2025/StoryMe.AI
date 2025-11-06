/**
 * Support Submission API Route
 * POST /api/support/submit
 *
 * Handles support ticket submissions from users (authenticated or anonymous)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/support/submit
 * Create a new support submission
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user (if authenticated)
    const { data: { user } } = await supabase.auth.getUser();

    // Parse request body
    const body = await request.json();
    const { title, description, email } = body;

    // Require authentication for support submissions
    if (!user) {
      return NextResponse.json(
        { error: 'Please log in to submit a support request' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!title || !description) {
      return NextResponse.json(
        { error: 'Title and description are required' },
        { status: 400 }
      );
    }

    // Validate input lengths to prevent abuse
    if (title.length > 200) {
      return NextResponse.json(
        { error: 'Title is too long (maximum 200 characters)' },
        { status: 400 }
      );
    }

    if (description.length > 5000) {
      return NextResponse.json(
        { error: 'Description is too long (maximum 5000 characters)' },
        { status: 400 }
      );
    }

    // Get user info
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const userEmail = userData?.email || user.email;
    const userName = userData?.full_name || null;

    // Get request metadata
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;

    // Insert support submission (user is authenticated, so permissions should work)
    const { data: submission, error: insertError } = await supabase
      .from('support_submissions')
      .insert({
        title: title.trim(),
        description: description.trim(),
        submission_type: 'issue', // Default type
        user_id: user.id,
        user_email: userEmail,
        user_name: userName,
        user_agent: userAgent,
        referrer_url: referrer,
        status: 'new',
        priority: 'medium',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating support submission:', insertError);
      console.error('Full error details:', JSON.stringify(insertError, null, 2));
      return NextResponse.json(
        { error: 'Failed to submit support request. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Support request submitted successfully',
        submission: {
          id: submission.id,
          created_at: submission.created_at,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/support/submit:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
