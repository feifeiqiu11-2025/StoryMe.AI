/**
 * Admin API: Regenerate Checkout link for an expired/pending bundle.
 *   POST /api/admin/school-bundles/[id]/regenerate-checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { regenerateCheckout, BundleError } from '@/lib/teams/schoolBundleService';

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
  const origin = request.nextUrl.origin;

  try {
    const result = await regenerateCheckout(
      id,
      `${origin}/admin/school-bundles?checkout=success`,
      `${origin}/admin/school-bundles?checkout=cancelled`
    );
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] regenerate error:', err);
    return NextResponse.json({ error: 'Failed to regenerate checkout' }, { status: 500 });
  }
}
