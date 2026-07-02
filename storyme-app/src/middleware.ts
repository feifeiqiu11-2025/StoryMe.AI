/**
 * Edge middleware — centralized authorization gate.
 *
 * Principle 1 (Security): every /api/admin/* route now requires a signed-in
 * admin, enforced here in ONE place. Previously each admin route had to
 * remember its own isAdminEmail() check, and several shipped without one. A
 * central gate means a newly-added admin route is protected by default — it
 * cannot accidentally ship unauthenticated.
 *
 * This is additive: existing per-route isAdminEmail() checks still run (defense
 * in depth). The matcher is scoped to /api/admin/* only, so no other route's
 * behavior changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { isAdminEmail } from '@/lib/auth/isAdmin';

export async function middleware(request: NextRequest) {
  // Response we can attach refreshed Supabase auth cookies to.
  const response = NextResponse.next({ request });

  // CORS preflight carries no credentials — never gate it, or legit
  // cross-origin admin POSTs (JSON) would fail at the preflight step.
  if (request.method === 'OPTIONS') {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validates the session against Supabase (and refreshes it if needed,
  // writing the new cookies onto `response`).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Admin access required' } },
      { status: 403 }
    );
  }

  return response;
}

export const config = {
  // Scope strictly to admin API routes — nothing else is affected.
  matcher: ['/api/admin/:path*'],
};
