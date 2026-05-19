/**
 * Admin API: Leads
 * GET /api/admin/leads
 *
 * Returns all inbound contact leads (newest first) for the admin dashboard.
 * Requires authenticated user with allowed admin email.
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
      .from('leads')
      .select(
        'id, email, name, interest, source, source_medium, auth_provider, user_id, message, consent_marketing, metadata, created_at'
      )
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error('[ADMIN /leads] DB error', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data ?? [] });
  } catch (err) {
    console.error('[ADMIN /leads] unexpected', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
