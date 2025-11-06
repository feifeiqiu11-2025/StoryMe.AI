/**
 * Support Admin API Route
 * GET /api/support/admin - List all support submissions (admin only)
 * PATCH /api/support/admin - Update submission status/notes (admin only)
 *
 * Restricted to feifei_qiu@hotmail.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Admin email - can be moved to environment variable if needed
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'feifei_qiu@hotmail.com';

/**
 * Check if current user is admin
 */
async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const { data: userData } = await supabase
    .from('users')
    .select('email')
    .eq('id', user.id)
    .single();

  return userData?.email === ADMIN_EMAIL;
}

/**
 * GET /api/support/admin
 * Get all support submissions (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check admin access
    if (!(await isAdmin(supabase))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('support_submissions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: submissions, error, count } = await query;

    if (error) {
      console.error('Error fetching support submissions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch support submissions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      submissions: submissions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error in GET /api/support/admin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/support/admin
 * Update support submission status/notes (admin only)
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check admin access
    if (!(await isAdmin(supabase))) {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json();
    const { id, status, priority, admin_notes } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Submission ID is required' },
        { status: 400 }
      );
    }

    // Build update object
    const updates: any = {
      reviewed_by: user?.email || ADMIN_EMAIL,
      reviewed_at: new Date().toISOString(),
    };

    if (status) {
      updates.status = status;
      if (status === 'resolved' || status === 'closed') {
        updates.resolved_at = new Date().toISOString();
      }
    }

    if (priority) {
      updates.priority = priority;
    }

    if (admin_notes !== undefined) {
      updates.admin_notes = admin_notes;
    }

    // Update submission
    const { data: submission, error: updateError } = await supabase
      .from('support_submissions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating support submission:', updateError);
      return NextResponse.json(
        { error: 'Failed to update support submission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      submission,
    });
  } catch (error) {
    console.error('Error in PATCH /api/support/admin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
