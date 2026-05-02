/**
 * Admin API: Email the Checkout link to the bundle's primary teacher.
 *   POST /api/admin/school-bundles/[id]/send-email
 *
 * Bundle must be in pending or checkout_expired state with a fresh Checkout
 * link (admin clicks Regenerate first if expired).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { emailCheckoutLinkToPrimary, BundleError } from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;

  try {
    await emailCheckoutLinkToPrimary(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] send-email error:', err);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
