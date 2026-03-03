/**
 * Admin API: Workshop Registrations
 * GET /api/admin/workshop-registrations
 *
 * Returns all workshop registrations for admin dashboard.
 * Requires authenticated user with allowed admin email.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'panglu7373@gmail.com',
];

export async function GET() {
  try {
    // Verify user is authenticated and is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes(user.email || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: registrations, error: dbError } = await supabaseAdmin
      .from('workshop_registrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('[ADMIN] Error fetching registrations:', dbError);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: registrations });
  } catch (error) {
    console.error('[ADMIN] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
