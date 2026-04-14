/**
 * Admin API: Toggle featured status on a public story
 * PATCH /api/admin/toggle-featured-story
 *
 * Only accessible by admin emails. Uses service role to update
 * stories the admin may not own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isAdminEmail } from '@/lib/auth/isAdmin';

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
    }

    const body = await request.json();
    const { projectId, featured } = body;

    if (!projectId || typeof projectId !== 'string' || typeof featured !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request: projectId (string) and featured (boolean) required' },
        { status: 400 }
      );
    }

    const adminClient = createServiceRoleClient();
    const { error: updateError } = await adminClient
      .from('projects')
      .update({ featured })
      .eq('id', projectId)
      .eq('visibility', 'public'); // Safety: only allow featuring public stories

    if (updateError) {
      console.error('Error toggling story featured status:', updateError);
      return NextResponse.json({ error: 'Failed to update featured status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, featured });
  } catch (err) {
    console.error('Unexpected error in toggle-featured-story API:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
