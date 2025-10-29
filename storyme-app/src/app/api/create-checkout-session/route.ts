/**
 * Create Stripe Checkout Session
 * POST /api/create-checkout-session
 *
 * Creates a Stripe checkout session for subscription purchase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { stripe, getPriceId } from '@/lib/stripe/config';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const { priceId, tier, cycle } = await request.json();

    // Validate inputs
    if (!tier || !cycle) {
      return NextResponse.json(
        { error: 'Missing tier or cycle' },
        { status: 400 }
      );
    }

    if (!['basic', 'premium', 'team'].includes(tier)) {
      return NextResponse.json(
        { error: 'Invalid tier' },
        { status: 400 }
      );
    }

    if (!['monthly', 'annual'].includes(cycle)) {
      return NextResponse.json(
        { error: 'Invalid billing cycle' },
        { status: 400 }
      );
    }

    // Get user's email and subscription info
    const { data: userData } = await supabase
      .from('users')
      .select('email, stripe_customer_id')
      .eq('id', user.id)
      .single();

    const email = userData?.email || user.email;

    // Get or create Stripe customer
    let customerId = userData?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: email!,
        metadata: {
          supabase_user_id: user.id,
        },
      });

      customerId = customer.id;

      // Save customer ID to database
      await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id);
    }

    // Determine the price ID
    const finalPriceId = priceId || getPriceId(tier as 'basic' | 'premium' | 'team', cycle as 'monthly' | 'annual');

    // Get the app URL - prioritize production domain
    // Use custom domain in production, fall back to origin header, then env var
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/');
    const isProduction = process.env.NODE_ENV === 'production';
    const productionDomain = 'https://www.kindlewoodstudio.ai';

    // In production, always use custom domain; in dev, use origin or localhost
    const appUrl = isProduction
      ? productionDomain
      : (origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002');

    console.log(`[CHECKOUT] Creating session with URLs:`, {
      appUrl,
      isProduction,
      origin,
      env: process.env.NEXT_PUBLIC_APP_URL
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: finalPriceId,
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
      sessionId: session.id,
      url: session.url,
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
