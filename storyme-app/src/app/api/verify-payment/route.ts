/**
 * Verify Payment Status API
 * GET /api/verify-payment?session_id=xxx
 *
 * Verifies Stripe checkout session payment status and ensures database is updated
 * This is a fallback in case webhooks haven't fired yet
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe } from '@/lib/stripe/config';
import Stripe from 'stripe';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get session_id from URL params
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing session_id parameter' },
        { status: 400 }
      );
    }

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    });

    // Verify this session belongs to the current user
    if (session.metadata?.supabase_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - session does not belong to user' },
        { status: 403 }
      );
    }

    // Get current user data from database
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier, subscription_status, stripe_subscription_id')
      .eq('id', user.id)
      .single();

    // Determine payment status
    const paymentStatus = session.payment_status; // 'paid', 'unpaid', 'no_payment_required'
    const sessionStatus = session.status; // 'complete', 'expired', 'open'

    // Check if subscription exists and is active
    let subscriptionStatus = null;
    let subscriptionTier = null;
    let isPaymentComplete = false;

    if (session.subscription && typeof session.subscription === 'object') {
      subscriptionStatus = session.subscription.status;
      subscriptionTier = session.metadata?.tier || 'basic';
      isPaymentComplete = paymentStatus === 'paid' && sessionStatus === 'complete';
    }

    // If payment is complete but database not updated, update it now (webhook may be delayed)
    if (isPaymentComplete && userData && userData.subscription_tier !== subscriptionTier) {
      console.log(`[VERIFY-PAYMENT] Payment verified but database not updated. Updating user ${user.id} to tier: ${subscriptionTier}`);

      // Determine stories limit
      let storiesLimit = 2; // default for free tier
      if (subscriptionTier === 'basic') storiesLimit = 20;
      if (subscriptionTier === 'premium' || subscriptionTier === 'team') storiesLimit = -1;

      // Get actual period start from subscription object
      const subscriptionObj = session.subscription as Stripe.Subscription;
      const periodStart = subscriptionObj?.current_period_start
        ? new Date(subscriptionObj.current_period_start * 1000).toISOString()
        : new Date().toISOString(); // Fallback to now if not available

      // Update database immediately
      const { error: updateError } = await supabase
        .from('users')
        .update({
          subscription_tier: subscriptionTier,
          subscription_status: subscriptionStatus,
          stories_limit: storiesLimit,
          stripe_subscription_id: subscriptionObj?.id || session.subscription as string,
          stripe_customer_id: session.customer as string,
          billing_cycle_start: periodStart,  // Use actual period start from Stripe
          stories_created_this_month: 0, // Reset count on new subscription
          trial_status: 'completed',
          // Keep trial_ends_at for historical data - UI checks trial_status
        })
        .eq('id', user.id);

      if (updateError) {
        console.error(`[VERIFY-PAYMENT] Failed to update user ${user.id}:`, updateError);
        // Don't throw - still return status even if update failed
      } else {
        console.log(`[VERIFY-PAYMENT] Database updated successfully for user ${user.id}`);
      }
    }

    // Return comprehensive status
    return NextResponse.json({
      success: true,
      payment: {
        status: paymentStatus,
        sessionStatus: sessionStatus,
        isComplete: isPaymentComplete,
      },
      subscription: {
        id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
        status: subscriptionStatus,
        tier: subscriptionTier,
      },
      database: {
        updated: isPaymentComplete && userData?.subscription_tier !== subscriptionTier,
        currentTier: userData?.subscription_tier,
        currentStatus: userData?.subscription_status,
      },
      message: isPaymentComplete
        ? '✓ Payment successful! Your subscription is now active.'
        : sessionStatus === 'open'
        ? '⏳ Payment is being processed. Please wait...'
        : sessionStatus === 'expired'
        ? '✗ Payment session expired. Please try again.'
        : paymentStatus === 'unpaid'
        ? '⚠️ Payment incomplete. Please complete payment or contact support.'
        : 'Processing your payment...',
    });

  } catch (error) {
    console.error('Error verifying payment:', error);

    // Handle specific Stripe errors
    if (error instanceof Error && error.message.includes('No such checkout.session')) {
      return NextResponse.json(
        { error: 'Invalid session ID or session expired' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to verify payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
