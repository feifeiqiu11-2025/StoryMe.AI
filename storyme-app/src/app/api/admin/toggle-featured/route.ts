/**
 * Admin API: Toggle featured status on a public character
 * PATCH /api/admin/toggle-featured
 *
 * Only accessible by admin emails. Uses service role to update
 * characters the admin may not own.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

const ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'admin@kindlewoodstudio.ai',
];

export async function PATCH(request: NextRequest) {
  try {
    // Verify authenticated user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
    }

    // Parse and validate body
    const body = await request.json();
    const { characterId, isFeatured } = body;

    if (!characterId || typeof characterId !== 'string' || typeof isFeatured !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request: characterId (string) and isFeatured (boolean) required' }, { status: 400 });
    }

    // Use service role to update (admin may not own the character)
    const adminClient = createServiceRoleClient();
    const { error: updateError } = await adminClient
      .from('character_library')
      .update({ is_featured: isFeatured })
      .eq('id', characterId)
      .eq('is_public', true); // Safety: only allow featuring public characters

    if (updateError) {
      console.error('Error toggling featured status:', updateError);
      return NextResponse.json({ error: 'Failed to update featured status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, isFeatured });
  } catch (err) {
    console.error('Unexpected error in toggle-featured API:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
