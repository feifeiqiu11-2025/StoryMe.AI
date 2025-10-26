/**
 * Stripe Webhook Handler
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for subscriptions
 * IMPORTANT: This endpoint must use raw body for signature verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'No signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (error) {
    console.error('Webhook signature verification failed:', error);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  console.log('Stripe webhook received:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle successful checkout completion
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.supabase_user_id;
  const tier = session.metadata?.tier;
  const cycle = session.metadata?.cycle;

  if (!userId) {
    console.error('No user ID in checkout session metadata');
    return;
  }

  console.log(`Checkout completed for user ${userId}, tier: ${tier}`);

  // Get subscription details
  const subscriptionId = session.subscription as string;
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription);
  }
}

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  const tier = subscription.metadata?.tier;

  if (!userId) {
    console.error('No user ID in subscription metadata');
    return;
  }

  console.log(`Updating subscription for user ${userId}:`, {
    status: subscription.status,
    tier,
  });

  // Determine stories limit based on tier
  let storiesLimit = 5; // default
  if (tier === 'basic') storiesLimit = 20;
  if (tier === 'premium' || tier === 'team') storiesLimit = -1; // unlimited

  // Get current user data to check if billing cycle changed
  const { data: currentUser } = await supabaseAdmin
    .from('users')
    .select('billing_cycle_start, subscription_tier, stories_created_this_month')
    .eq('id', userId)
    .single();

  const currentBillingCycleStart = currentUser?.billing_cycle_start
    ? new Date(currentUser.billing_cycle_start).getTime()
    : 0;
  const newBillingCycleStart = subscription.current_period_start
    ? new Date(subscription.current_period_start * 1000).getTime()
    : 0;

  // Update user subscription in database
  const userUpdateData: any = {
    subscription_tier: tier || 'basic',
    subscription_status: subscription.status,
    stories_limit: storiesLimit,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
  };

  // If subscription is active, end the trial
  if (subscription.status === 'active') {
    userUpdateData.trial_status = 'completed';
  }

  // Add billing_cycle_start only if current_period_start exists
  if (subscription.current_period_start) {
    userUpdateData.billing_cycle_start = new Date(subscription.current_period_start * 1000).toISOString();
  }

  // Reset story count in these cases:
  // 1. New subscription (no previous billing cycle)
  // 2. Billing cycle changed (new month started)
  // 3. Tier changed (upgrade/downgrade) - give them a fresh start
  // 4. Status changed from incomplete to active (payment completed)
  const isNewSubscription = !currentUser?.billing_cycle_start;
  const billingCycleChanged = newBillingCycleStart > 0 && currentBillingCycleStart > 0 &&
    newBillingCycleStart !== currentBillingCycleStart;
  const tierChanged = currentUser?.subscription_tier !== tier;
  const statusBecameActive = currentUser?.subscription_tier !== 'free' &&
    subscription.status === 'active' &&
    (!currentUser || currentUser.subscription_tier === tier);

  if (isNewSubscription || billingCycleChanged || tierChanged) {
    userUpdateData.stories_created_this_month = 0;
    console.log(`Resetting story count for user ${userId} (reason: ${
      isNewSubscription ? 'new subscription' :
      billingCycleChanged ? 'billing cycle changed' :
      'tier changed'
    })`);
  }

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update(userUpdateData)
    .eq('id', userId);

  if (userError) {
    console.error('Error updating user subscription:', userError);
    throw userError;
  }

  // Upsert subscription record
  const subscriptionData: any = {
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    tier: tier || 'basic',
    status: subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };

  // Add date fields only if they exist
  if (subscription.current_period_start) {
    subscriptionData.current_period_start = new Date(subscription.current_period_start * 1000).toISOString();
  }
  if (subscription.current_period_end) {
    subscriptionData.current_period_end = new Date(subscription.current_period_end * 1000).toISOString();
  }
  if (subscription.canceled_at) {
    subscriptionData.cancelled_at = new Date(subscription.canceled_at * 1000).toISOString();
  }

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscriptionData);

  if (subError) {
    console.error('Error upserting subscription:', subError);
    throw subError;
  }

  console.log(`Successfully updated subscription for user ${userId}`);
}

/**
 * Handle subscription deletion/cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;

  if (!userId) {
    console.error('No user ID in subscription metadata');
    return;
  }

  console.log(`Subscription deleted for user ${userId}`);

  // Revert user to trial/free tier
  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      stories_limit: 5,
      stripe_subscription_id: null,
    })
    .eq('id', userId);

  if (userError) {
    console.error('Error reverting user to free tier:', userError);
    throw userError;
  }

  // Update subscription record
  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);

  if (subError) {
    console.error('Error updating subscription record:', subError);
  }

  console.log(`Successfully handled subscription deletion for user ${userId}`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await handleSubscriptionUpdate(subscription);
  }

  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const userId = invoice.subscription_details?.metadata?.supabase_user_id;

  if (!userId) {
    console.error('No user ID in invoice metadata');
    return;
  }

  console.log(`Payment failed for user ${userId}, invoice: ${invoice.id}`);

  // Update subscription status to past_due
  const { error } = await supabaseAdmin
    .from('users')
    .update({
      subscription_status: 'past_due',
    })
    .eq('id', userId);

  if (error) {
    console.error('Error updating user status to past_due:', error);
  }

  // TODO: Send email notification to user about failed payment
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
