/**
 * Admin API: List + create school bundles
 *   GET  /api/admin/school-bundles
 *   POST /api/admin/school-bundles
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import {
  createBundle,
  listBundles,
  BundleError,
} from '@/lib/teams/schoolBundleService';

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) };
  if (!isAdminEmail(user.email)) return { error: NextResponse.json({ error: 'Admin only' }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const bundles = await listBundles();
    return NextResponse.json({ success: true, data: bundles });
  } catch (err) {
    console.error('[admin/school-bundles] list error:', err);
    return NextResponse.json({ error: 'Failed to list bundles' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: { schoolName?: string; primaryEmail?: string; memberEmails?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body.schoolName || !body.primaryEmail) {
    return NextResponse.json({ error: 'schoolName and primaryEmail required' }, { status: 400 });
  }

  const origin = request.nextUrl.origin;

  try {
    const result = await createBundle({
      schoolName: body.schoolName!,
      primaryEmail: body.primaryEmail!,
      memberEmails: body.memberEmails || [],
      successUrl: `${origin}/admin/school-bundles?checkout=success`,
      cancelUrl: `${origin}/admin/school-bundles?checkout=cancelled`,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof BundleError) {
      const status = err.code === 'VALIDATION_FAILED' ? 400 : 422;
      return NextResponse.json(
        { error: err.message, code: err.code, details: err.details },
        { status }
      );
    }
    console.error('[admin/school-bundles] create error:', err);
    return NextResponse.json({ error: 'Failed to create bundle' }, { status: 500 });
  }
}
