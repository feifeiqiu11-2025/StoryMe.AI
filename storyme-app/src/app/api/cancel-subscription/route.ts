/**
 * Cancel Subscription API
 * POST /api/cancel-subscription
 * Cancels the user's Stripe subscription at period end
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { stripe } from '@/lib/stripe/config';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // Get auth token from Authorization header (for cross-app requests)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Use service role client to validate token and get user
    const serviceRoleClient = createServiceRoleClient();

    let user;
    let userId;

    if (token) {
      // Authenticate using bearer token from Kids app
      const { data: { user: tokenUser }, error: tokenError } =
        await serviceRoleClient.auth.getUser(token);

      if (tokenError || !tokenUser) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      user = tokenUser;
      userId = tokenUser.id;
    } else {
      // Fall back to cookie-based auth for Studio app web UI
      const supabase = await createClient();
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !cookieUser) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      user = cookieUser;
      userId = cookieUser.id;
    }

    // Use service role client for database operations
    const supabase = serviceRoleClient;

    // Get user's subscription data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id, subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    if (!userData.stripe_subscription_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    // Cancel subscription at period end in Stripe
    const subscription = await stripe.subscriptions.update(
      userData.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period',
      cancelAt: subscription.cancel_at,
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
