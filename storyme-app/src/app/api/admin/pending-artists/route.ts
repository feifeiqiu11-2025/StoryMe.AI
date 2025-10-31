/**
 * Admin API: Get all pending artist profiles
 * Only accessible by admin email: feifei_qiu@hotmail.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ADMIN_EMAIL = 'feifei_qiu@hotmail.com';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Check if user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Check if user is admin
  if (user.email !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: 'Unauthorized - Admin access only' },
      { status: 403 }
    );
  }

  // Fetch all artists with pending_review status (admin can see all)
  const { data: artists, error } = await supabase
    .from('little_artists')
    .select(`
      id,
      name,
      age,
      bio,
      profile_photo_url,
      parent_consent_text,
      parent_consent_date,
      status,
      parent_user_id,
      created_at
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending artists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending artists' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    artists: artists || [],
    isAdmin: true,
  });
}
