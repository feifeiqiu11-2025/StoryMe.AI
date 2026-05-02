/**
 * Admin API: List + add members of a school bundle.
 *   GET  /api/admin/school-bundles/[id]/members         → list members
 *   POST /api/admin/school-bundles/[id]/members         → add member { email }
 *
 * Removal lives in [userId]/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import { addMember, listMembers, BundleError } from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  try {
    const members = await listMembers(id);
    return NextResponse.json({ success: true, data: members });
  } catch (err) {
    if (err instanceof BundleError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    console.error('[admin/school-bundles] list members error:', err);
    return NextResponse.json({ error: 'Failed to list members' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const { id } = await params;
  let body: { email?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  if (!body.email || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'email (string) required' }, { status: 400 });
  }

  try {
    const result = await addMember(id, body.email);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof BundleError) {
      const status = err.code === 'VALIDATION_FAILED' ? 400 : 422;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[admin/school-bundles] add member error:', err);
    return NextResponse.json({ error: 'Failed to add member' }, { status: 500 });
  }
}
