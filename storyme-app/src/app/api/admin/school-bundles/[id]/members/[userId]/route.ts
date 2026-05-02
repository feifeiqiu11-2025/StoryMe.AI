/**
 * Admin API: Remove a teacher from a bundle.
 *   DELETE /api/admin/school-bundles/[id]/members/[userId]
 *
 * The Stripe subscription is unchanged — school keeps paying for the seat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { removeMember, BundleError } from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id, userId } = await params;

  try {
    await removeMember(id, userId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] remove member error:', err);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }
}
