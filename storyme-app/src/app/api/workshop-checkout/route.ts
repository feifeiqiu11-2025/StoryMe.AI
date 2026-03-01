/**
 * Workshop Checkout API
 * POST /api/workshop-checkout
 *
 * Creates a Stripe checkout session for workshop registration (one-time payment).
 * No authentication required — workshops are open for public registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { WorkshopRegistrationSchema } from '@/lib/workshops/schemas';
import { WORKSHOP_PARTNERS, formatWorkshopPrice } from '@/lib/workshops/constants';
import { createClient } from '@supabase/supabase-js';

// Service role client for public inserts (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request with Zod
    const parseResult = WorkshopRegistrationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parseResult.error.issues,
        },
        { status: 400 },
      );
    }

    const validated = parseResult.data;

    // Find partner configuration
    const partner = WORKSHOP_PARTNERS.find((p) => p.id === validated.partnerId);
    if (!partner || partner.comingSoon) {
      return NextResponse.json(
        { error: 'Invalid or unavailable partner program' },
        { status: 400 },
      );
    }

    // Per-session pricing (promo price if available, else original)
    const sessionPricing = partner.pricing[validated.selectedSessionType];
    const unitAmount = sessionPricing.promoPrice || sessionPricing.originalPrice;
    const totalAmount = validated.selectedWorkshopIds.length * unitAmount;

    // --- Bundle pricing (commented out for future use) ---
    // const isBundle =
    //   validated.selectedWorkshopIds.length >= partner.pricing.bundleCount;
    // const totalAmount = isBundle
    //   ? partner.pricing.bundlePrice
    //   : validated.selectedWorkshopIds.length * partner.pricing.singleWorkshop;

    // Store registration in DB (pending payment)
    const { data: registration, error: dbError } = await supabaseAdmin
      .from('workshop_registrations')
      .insert({
        parent_first_name: validated.parentFirstName,
        parent_last_name: validated.parentLastName,
        parent_email: validated.parentEmail,
        parent_phone: validated.parentPhone,
        child_first_name: validated.childFirstName,
        child_last_name: validated.childLastName || null,
        child_age: validated.childAge,
        emergency_contact_name: validated.emergencyContactName,
        emergency_contact_phone: validated.emergencyContactPhone,
        emergency_contact_relation: validated.emergencyContactRelation,
        partner_id: validated.partnerId,
        selected_workshop_ids: validated.selectedWorkshopIds,
        selected_session_type: validated.selectedSessionType,
        is_bundle: false,
        promo_code: null,
        waiver_accepted: true,
        waiver_accepted_at: new Date().toISOString(),
        payment_status: 'pending',
        status: 'pending',
      })
      .select()
      .single();

    if (dbError || !registration) {
      console.error('[WORKSHOP-CHECKOUT] DB insert error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create registration' },
        { status: 500 },
      );
    }

    // Build Stripe line items — one per selected session
    const sessionDescription = validated.selectedSessionType === 'morning'
      ? 'Morning Session (Ages 4–6) · 10:00–11:00 AM'
      : 'Afternoon Session (Ages 7–9) · 1:00–3:00 PM';

    const lineItems = validated.selectedWorkshopIds.map((workshopId) => {
      const session = partner.sessions.find((s) => s.id === workshopId);
      const dateLabel = session?.dateLabel || workshopId;
      return {
        price_data: {
          currency: partner.pricing.currency,
          product_data: {
            name: `${partner.name} — Workshop`,
            description: `${sessionDescription} · ${dateLabel}`,
          },
          unit_amount: unitAmount,
        },
        quantity: 1,
      };
    });

    // --- Bundle line items (commented out for future use) ---
    // const lineItems = isBundle
    //   ? [{
    //       price_data: {
    //         currency: partner.pricing.currency,
    //         product_data: {
    //           name: `${partner.name} — ${partner.pricing.bundleCount}-Workshop Bundle`,
    //           description: `${sessionDescription} • All ${partner.pricing.bundleCount} Sundays`,
    //         },
    //         unit_amount: partner.pricing.bundlePrice,
    //       },
    //       quantity: 1,
    //     }]
    //   : validated.selectedWorkshopIds.map(...);

    // Build URLs (following existing checkout session pattern)
    const origin =
      request.headers.get('origin') ||
      request.headers
        .get('referer')
        ?.split('/')
        .slice(0, 3)
        .join('/');
    const isProduction = process.env.NODE_ENV === 'production';
    const productionDomain = 'https://www.kindlewoodstudio.ai';
    const appUrl = isProduction
      ? productionDomain
      : origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002';

    // Create Stripe checkout session (one-time payment)
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: validated.parentEmail,
      line_items: lineItems,
      success_url: `${appUrl}/workshops/register?registration=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/workshops/register?registration=cancelled`,
      allow_promotion_codes: true,
      metadata: {
        registration_id: registration.id,
        partner_id: validated.partnerId,
        type: 'workshop',
      },
    });

    // Update registration with Stripe session ID
    await supabaseAdmin
      .from('workshop_registrations')
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .eq('id', registration.id);

    console.log('[WORKSHOP-CHECKOUT] Session created:', {
      registrationId: registration.id,
      sessionId: checkoutSession.id,
      amount: formatWorkshopPrice(totalAmount),
      workshopCount: validated.selectedWorkshopIds.length,
    });

    return NextResponse.json({
      success: true,
      sessionId: checkoutSession.id,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error('[WORKSHOP-CHECKOUT] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
