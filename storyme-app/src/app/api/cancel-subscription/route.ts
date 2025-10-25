/**
 * Cancel Subscription API
 * POST /api/cancel-subscription
 * Cancels the user's Stripe subscription at period end
 */

import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

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
