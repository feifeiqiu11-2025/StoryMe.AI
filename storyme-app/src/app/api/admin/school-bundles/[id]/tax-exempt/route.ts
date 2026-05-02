/**
 * Admin API: Mark a bundle as tax-exempt (or remove).
 *   POST /api/admin/school-bundles/[id]/tax-exempt
 *   body: { exempt: boolean, note?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { setTaxExempt, BundleError } from '@/lib/teams/schoolBundleService';

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
  let body: { exempt?: boolean; note?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (typeof body.exempt !== 'boolean') {
    return NextResponse.json({ error: 'exempt (boolean) required' }, { status: 400 });
  }

  try {
    await setTaxExempt(id, body.exempt, body.note);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] tax-exempt error:', err);
    return NextResponse.json({ error: 'Failed to update tax exempt' }, { status: 500 });
  }
}
