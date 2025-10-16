import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
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
