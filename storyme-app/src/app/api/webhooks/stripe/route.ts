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

  console.log(`[WEBHOOK] Stripe webhook received: ${event.type} (ID: ${event.id})`);

  // Layer 5: Idempotency Check - Prevent processing the same event twice
  // Stripe may send the same event multiple times if they don't receive a 200 response quickly
  const { data: existingEvent } = await supabaseAdmin
    .from('webhook_events')
    .select('id, processed_at')
    .eq('stripe_event_id', event.id)
    .single();

  if (existingEvent) {
    console.log(`[WEBHOOK] Event ${event.id} already processed at ${existingEvent.processed_at}, skipping`);
    return NextResponse.json({
      received: true,
      skipped: true,
      reason: 'Event already processed (idempotency check)'
    });
  }

  // Record that we're processing this event (before actual processing for safety)
  await supabaseAdmin
    .from('webhook_events')
    .insert({
      stripe_event_id: event.id,
      event_type: event.type,
      success: false,  // Will update to true if successful
      metadata: event as any
    });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.type === 'workshop') {
          await handleWorkshopCheckoutCompleted(session);
        } else {
          await handleCheckoutCompleted(session);
        }
        break;
      }

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
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    // Mark event as successfully processed
    await supabaseAdmin
      .from('webhook_events')
      .update({ success: true })
      .eq('stripe_event_id', event.id);

    console.log(`[WEBHOOK] Event ${event.id} processed successfully`);
    return NextResponse.json({ received: true });

  } catch (error) {
    console.error(`[WEBHOOK] Error processing event ${event.id}:`, error);

    // Record the error
    await supabaseAdmin
      .from('webhook_events')
      .update({
        success: false,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      })
      .eq('stripe_event_id', event.id);
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

  console.log(`[WEBHOOK] Updating subscription for user ${userId}:`, {
    subscriptionId: subscription.id,
    status: subscription.status,
    tier,
    currentPeriodStart: subscription.current_period_start,
    currentPeriodEnd: subscription.current_period_end,
  });

  // Determine stories limit based on tier
  let storiesLimit = 2; // default for free tier
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

  // If user has a paid subscription, mark trial as completed
  // Keep trial_ends_at for historical records - UI checks trial_status to determine if trial is active
  // Trial is one-time only - once completed, it stays completed even if user cancels and resubscribes
  if (tier && tier !== 'free') {
    userUpdateData.trial_status = 'completed';
    // Keep trial_ends_at for historical data
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
    console.log(`[WEBHOOK] Resetting story count for user ${userId}:`, {
      reason: isNewSubscription ? 'new subscription' :
              billingCycleChanged ? 'billing cycle changed' :
              'tier changed',
      oldTier: currentUser?.subscription_tier,
      newTier: tier,
      oldCount: currentUser?.stories_created_this_month,
    });
  }

  console.log(`[WEBHOOK] Updating user ${userId} in database:`, {
    tier: userUpdateData.subscription_tier,
    status: userUpdateData.subscription_status,
    limit: userUpdateData.stories_limit,
    resetCount: userUpdateData.stories_created_this_month === 0,
  });

  const { error: userError } = await supabaseAdmin
    .from('users')
    .update(userUpdateData)
    .eq('id', userId);

  if (userError) {
    console.error('[WEBHOOK] Error updating user subscription:', userError);
    throw userError;
  }

  console.log(`[WEBHOOK] User ${userId} updated successfully in database`);

  // Layer 4: Smart Upsert - Only update if new data is better quality
  // Check if subscription record already exists
  const { data: existingSubscription } = await supabaseAdmin
    .from('subscriptions')
    .select('*')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  // Determine if we should update based on data quality
  const hasValidDates = subscription.current_period_start && subscription.current_period_end;
  const existingHasValidDates = existingSubscription?.current_period_start && existingSubscription?.current_period_end;

  // Don't downgrade data quality: Skip update if existing has valid dates but new data doesn't
  if (existingSubscription && existingHasValidDates && !hasValidDates) {
    console.log(`[WEBHOOK] Skipping subscription update - existing record has better data quality`, {
      subscriptionId: subscription.id,
      existingDates: {
        start: existingSubscription.current_period_start,
        end: existingSubscription.current_period_end
      },
      newDates: {
        start: subscription.current_period_start,
        end: subscription.current_period_end
      }
    });
    // Still update user table (already done above), just skip subscriptions table update
    return;
  }

  // Build subscription data object
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

  console.log(`[WEBHOOK] Upserting subscription with data quality check passed`, {
    subscriptionId: subscription.id,
    hasValidDates,
    willUpdate: true
  });

  const { error: subError } = await supabaseAdmin
    .from('subscriptions')
    .upsert(subscriptionData, {
      onConflict: 'stripe_subscription_id',  // Prevent duplicate subscriptions
      ignoreDuplicates: false  // Update existing record on conflict
    });

  if (subError) {
    console.error('[WEBHOOK] Error upserting subscription:', subError);
    throw subError;
  }

  console.log(`[WEBHOOK] ✓ Successfully updated subscription for user ${userId}`, {
    tier: tier || 'basic',
    status: subscription.status,
    storiesLimit,
  });
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

  // Revert user to free tier (no new trial - trial is one-time only)
  const { error: userError } = await supabaseAdmin
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_status: 'cancelled',
      stories_limit: 2,
      stripe_subscription_id: null,
      billing_cycle_start: null,  // No longer on a billing cycle
      // Keep trial_ends_at and trial_status as-is (trial was already used)
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

/**
 * Handle workshop checkout completion (one-time payment)
 */
async function handleWorkshopCheckoutCompleted(session: Stripe.Checkout.Session) {
  const registrationId = session.metadata?.registration_id;

  if (!registrationId) {
    console.error('[WEBHOOK] No registration_id in workshop checkout metadata');
    return;
  }

  console.log(`[WEBHOOK] Workshop checkout completed for registration ${registrationId}`);

  const { error } = await supabaseAdmin
    .from('workshop_registrations')
    .update({
      payment_status: 'paid',
      status: 'confirmed',
      stripe_payment_intent_id: session.payment_intent as string,
      amount_paid: session.amount_total,
    })
    .eq('id', registrationId);

  if (error) {
    console.error('[WEBHOOK] Error updating workshop registration:', error);
    throw error;
  }

  console.log(`[WEBHOOK] Workshop registration ${registrationId} confirmed`);
  // TODO: Send confirmation email to parent
}

// Disable body parsing for webhook signature verification
export const config = {
  api: {
    bodyParser: false,
  },
};
