/**
 * Admin API: Survey responses
 * GET /api/admin/surveys
 *
 * Returns all survey submissions (newest first) for the admin dashboard.
 * Requires an authenticated user with an allowed admin email. Reads via the
 * service-role client because `survey_responses` has RLS with no public read.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isAdminEmail } from '@/lib/auth/isAdmin';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from('survey_responses')
      .select('id, survey_slug, survey_type, answers, name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(2000);

    if (error) {
      console.error('[ADMIN /surveys] DB error', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error('[ADMIN /surveys] unexpected', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
