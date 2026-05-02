/**
 * Admin API: Generate Stripe Customer Portal URL for a bundle.
 * School admin uses this to manage card, view invoices, cancel.
 *   POST /api/admin/school-bundles/[id]/portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { createPortalSession, BundleError } from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  const returnUrl = `${request.nextUrl.origin}/admin/school-bundles`;

  try {
    const result = await createPortalSession(id, returnUrl);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] portal error:', err);
    return NextResponse.json({ error: 'Failed to create portal session' }, { status: 500 });
  }
}
