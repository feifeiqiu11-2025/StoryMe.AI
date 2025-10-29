/**
 * Change Subscription API
 * POST /api/change-subscription
 * Upgrades or downgrades an existing subscription
 */

import { createClient } from '@/lib/supabase/server';
import { stripe, getPriceId } from '@/lib/stripe/config';
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

    // Get tier and cycle from request
    const { tier, cycle } = await request.json();

    if (!tier || !cycle) {
      return NextResponse.json(
        { error: 'Missing tier or cycle' },
        { status: 400 }
      );
    }

    // Get user's subscription data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('stripe_subscription_id, stripe_customer_id, subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to fetch user data' },
        { status: 500 }
      );
    }

    // Get the new price ID
    const newPriceId = getPriceId(tier as 'basic' | 'premium' | 'team', cycle as 'monthly' | 'annual');

    // If user has an existing subscription, update it
    if (userData.stripe_subscription_id) {
      // Get the current subscription
      const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id);

      // Update the subscription to the new price
      const updatedSubscription = await stripe.subscriptions.update(userData.stripe_subscription_id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: newPriceId,
          },
        ],
        proration_behavior: 'create_prorations', // Charge/credit difference immediately
        metadata: {
          supabase_user_id: user.id,
          tier,
          cycle,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Subscription updated successfully',
        subscriptionId: updatedSubscription.id,
      });
    } else {
      // No existing subscription - create checkout session instead
      // Get the app URL - prioritize production domain
      const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');
      const isProduction = process.env.NODE_ENV === 'production';
      const productionDomain = 'https://www.kindlewoodstudio.ai';

      // In production, always use custom domain; in dev, use origin or localhost
      const appUrl = isProduction
        ? productionDomain
        : (origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002');

      console.log(`[CHANGE-SUBSCRIPTION] Creating session with URLs:`, {
        appUrl,
        isProduction,
        origin,
        env: process.env.NEXT_PUBLIC_APP_URL
      });

      // Get or create customer
      let customerId = userData.stripe_customer_id;

      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email!,
          metadata: {
            supabase_user_id: user.id,
          },
        });
        customerId = customer.id;

        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', user.id);
      }

      // Create checkout session for new subscription
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [
          {
            price: newPriceId,
            quantity: 1,
          },
        ],
        success_url: `${appUrl}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/upgrade?canceled=true`,
        metadata: {
          supabase_user_id: user.id,
          tier,
          cycle,
        },
        subscription_data: {
          metadata: {
            supabase_user_id: user.id,
            tier,
            cycle,
          },
        },
        allow_promotion_codes: true,
        billing_address_collection: 'auto',
      });

      return NextResponse.json({
        success: true,
        checkoutUrl: session.url,
      });
    }

  } catch (error) {
    console.error('Change subscription error:', error);
    return NextResponse.json(
      {
        error: 'Failed to change subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
