/**
 * Admin API: Delete (only pending/cancelled) bundles
 *   DELETE /api/admin/school-bundles/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { deleteBundle, BundleError } from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    await deleteBundle(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.code === 'NOT_FOUND' ? 404 : 422 }
      );
    }
    console.error('[admin/school-bundles] delete error:', err);
    return NextResponse.json({ error: 'Failed to delete bundle' }, { status: 500 });
  }
}
