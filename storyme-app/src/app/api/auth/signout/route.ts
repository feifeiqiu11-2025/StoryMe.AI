import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function handleSignOut(request: NextRequest) {
  const supabase = await createClient();

  // Sign out from Supabase
  await supabase.auth.signOut();

  // Get the origin from the request to redirect to the correct port
  const origin = request.headers.get('origin') ||
                 request.headers.get('referer')?.split('/').slice(0, 3).join('/') ||
                 process.env.NEXT_PUBLIC_APP_URL ||
                 'http://localhost:3000';

  // Redirect to home page
  return NextResponse.redirect(new URL('/', origin));
}

export async function POST(request: NextRequest) {
  return handleSignOut(request);
}

export async function GET(request: NextRequest) {
  return handleSignOut(request);
}
