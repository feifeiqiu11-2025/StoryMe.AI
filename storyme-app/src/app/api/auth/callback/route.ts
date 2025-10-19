/**
 * Auth callback route for Supabase
 * Handles OAuth and magic link authentication
 * Creates user record in users table if it doesn't exist
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Ensure user record exists in users table
      // This is especially important for OAuth users who bypass the signup page
      const userId = data.user.id;
      const email = data.user.email;
      const name = data.user.user_metadata?.name ||
                   data.user.user_metadata?.full_name ||
                   email?.split('@')[0] ||
                   'User';

      // Check if user record exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      // Create user record if it doesn't exist
      if (!existingUser) {
        console.log('Creating user record for OAuth user:', userId, email);

        const trialStartDate = new Date();
        const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

        const { error: userError } = await supabase
          .from('users')
          .insert([{
            id: userId,
            email: email,
            name: name,
            subscription_tier: 'free',
            trial_started_at: trialStartDate.toISOString(),
            trial_ends_at: trialEndDate.toISOString(),
            images_generated_count: 0,
            images_limit: 50,
            trial_status: 'active'
          }]);

        if (userError) {
          console.error('Error creating user record:', userError);
          // Don't fail the login if user creation fails
          // The user is still authenticated, just missing the extended profile
        } else {
          console.log('Successfully created user record for OAuth user');
        }
      }

      // Redirect to next page
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
