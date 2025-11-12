/**
 * Sign Out API Route
 * Handles user logout and redirects to home page
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

async function handleSignOut(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const requestUrl = new URL(request.url);

    // Create Supabase client with custom cookie handlers for route handlers
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            // In route handlers, we CAN modify cookies
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Sign out from Supabase - this will delete the auth cookies
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[SIGNOUT] Error signing out:', error);
    } else {
      console.log('[SIGNOUT] User signed out successfully');
    }

    // Redirect to home page
    const response = NextResponse.redirect(new URL('/', requestUrl.origin), {
      status: 303, // Use 303 See Other for POST-redirect-GET pattern
    });

    console.log('[SIGNOUT] Redirecting to:', requestUrl.origin);

    return response;
  } catch (error) {
    console.error('[SIGNOUT] Unexpected error:', error);

    // Even on error, redirect to home to clear client state
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/', requestUrl.origin), {
      status: 303,
    });
  }
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}
