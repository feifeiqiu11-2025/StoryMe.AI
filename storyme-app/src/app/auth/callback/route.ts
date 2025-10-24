/**
 * Auth Callback Route
 * Handles Supabase auth callbacks (email verification, password reset, etc.)
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/dashboard';
  const type = requestUrl.searchParams.get('type');

  if (code) {
    const supabase = await createClient();

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If it's a password recovery, redirect to reset password page
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/reset-password', requestUrl.origin));
      }

      // Otherwise redirect to the specified next URL or dashboard
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    // Handle specific errors
    if (error) {
      console.error('Auth callback error:', error);

      // If it's a recovery link that expired or was already used
      if (type === 'recovery') {
        return NextResponse.redirect(
          new URL('/reset-link-expired', requestUrl.origin)
        );
      }

      // For other auth errors
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
      );
    }
  }

  // If there's no code, redirect to login
  return NextResponse.redirect(new URL('/login?error=auth_callback_failed', requestUrl.origin));
}
