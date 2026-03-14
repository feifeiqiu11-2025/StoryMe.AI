/**
 * Workshop Checkout API
 * POST /api/workshop-checkout
 *
 * Creates a Stripe checkout session for workshop registration (one-time payment).
 * Supports both individual session selection (SteamOji) and series enrollment (Avocado).
 * No authentication required — workshops are open for public registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/config';
import { WorkshopRegistrationSchema } from '@/lib/workshops/schemas';
import {
  WORKSHOP_PARTNERS,
  formatWorkshopPrice,
  getPartnerSessionPricing,
  getPartnerCapacity,
} from '@/lib/workshops/constants';
import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

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

    const isSingleMode = partner.sessionMode === 'single';
    const sessionTypeForQuery = isSingleMode ? 'single' : validated.selectedSessionType;

    // Validate location for multi-location partners
    if (partner.locations && partner.locations.length > 0) {
      if (!validated.selectedLocation) {
        return NextResponse.json(
          { error: 'Location selection is required for this partner' },
          { status: 400 },
        );
      }
      const validLocation = partner.locations.find(l => l.slug === validated.selectedLocation);
      if (!validLocation) {
        return NextResponse.json(
          { error: 'Invalid location selected' },
          { status: 400 },
        );
      }
    }

    // Reject non-enrollable sessions (e.g., Series 2 preview sessions)
    const enrollableIds = new Set(
      partner.sessions.filter(s => s.enrollable !== false).map(s => s.id),
    );
    const invalidSessions = validated.selectedWorkshopIds.filter(id => !enrollableIds.has(id));
    if (invalidSessions.length > 0) {
      return NextResponse.json(
        { error: 'Selected sessions are not currently available for enrollment', invalidSessions },
        { status: 400 },
      );
    }

    // Check spot availability before proceeding
    const supabaseAvailability = createServiceRoleClient();

    // Use v2 RPC for location-aware counting when applicable
    const useLocationRpc = isSingleMode && validated.selectedLocation;
    const rpcName = useLocationRpc
      ? 'get_workshop_registration_counts_v2'
      : 'get_workshop_registration_counts';

    const rpcParams: Record<string, string | null> = {
      p_partner_id: validated.partnerId,
      p_session_type: sessionTypeForQuery,
    };
    if (useLocationRpc) {
      rpcParams.p_location = validated.selectedLocation || null;
    }

    const { data: currentCounts, error: rpcError } = await supabaseAvailability.rpc(
      rpcName,
      rpcParams,
    );

    if (rpcError) {
      console.error('[WORKSHOP-CHECKOUT] Availability check failed:', rpcError);
      return NextResponse.json(
        { error: 'Failed to verify availability' },
        { status: 500 },
      );
    }

    const countMap: Record<string, number> = {};
    for (const row of currentCounts || []) {
      countMap[row.workshop_id] = Number(row.registration_count);
    }

    const capacity = getPartnerCapacity(
      partner,
      isSingleMode ? 'single' : validated.selectedSessionType,
      validated.selectedLocation,
    );
    const numberOfChildren = validated.children.length;
    const fullSessions: string[] = [];

    for (const workshopId of validated.selectedWorkshopIds) {
      const currentCount = countMap[workshopId] || 0;
      if (currentCount + numberOfChildren > capacity) {
        fullSessions.push(workshopId);
      }
    }

    if (fullSessions.length > 0) {
      return NextResponse.json(
        {
          error: 'Some sessions are fully booked',
          code: 'SESSIONS_FULL',
          fullSessions,
        },
        { status: 409 },
      );
    }

    // Calculate pricing
    const sessionPricing = getPartnerSessionPricing(
      partner,
      isSingleMode ? 'single' : validated.selectedSessionType,
    );
    const unitAmount = sessionPricing.promoPrice ?? sessionPricing.originalPrice;
    const totalAmount = validated.selectedWorkshopIds.length * unitAmount * numberOfChildren;

    // Calculate sales tax (WA state ESSB 5814 — enrichment workshops)
    let taxRate = 0;
    if (partner.locations && validated.selectedLocation) {
      const loc = partner.locations.find(l => l.slug === validated.selectedLocation);
      taxRate = loc?.taxRate ?? 0;
    } else if (partner.location?.taxRate) {
      taxRate = partner.location.taxRate;
    }
    const taxAmount = taxRate > 0 ? Math.round(totalAmount * taxRate) : 0;

    // Store one registration per child in DB (pending payment)
    const registrationIds: string[] = [];
    for (const child of validated.children) {
      const { data: registration, error: dbError } = await supabaseAdmin
        .from('workshop_registrations')
        .insert({
          parent_first_name: validated.parentFirstName,
          parent_last_name: validated.parentLastName,
          parent_email: validated.parentEmail,
          parent_phone: validated.parentPhone,
          child_first_name: child.firstName,
          child_last_name: child.lastName || null,
          child_age: child.age,
          emergency_contact_name: validated.emergencyContactName,
          emergency_contact_phone: validated.emergencyContactPhone,
          emergency_contact_relation: validated.emergencyContactRelation,
          partner_id: validated.partnerId,
          selected_workshop_ids: validated.selectedWorkshopIds,
          selected_session_type: sessionTypeForQuery,
          is_bundle: partner.enrollmentMode === 'series',
          location: validated.selectedLocation || null,
          promo_code: null,
          waiver_accepted: true,
          waiver_accepted_at: new Date().toISOString(),
          photo_video_consent_accepted: validated.photoVideoConsentAccepted === true,
          photo_video_consent_accepted_at: validated.photoVideoConsentAccepted ? new Date().toISOString() : null,
          payment_status: 'pending',
          status: 'pending',
        })
        .select('id')
        .single();

      if (dbError || !registration) {
        console.error('[WORKSHOP-CHECKOUT] DB insert error:', dbError);
        return NextResponse.json(
          { error: 'Failed to create registration' },
          { status: 500 },
        );
      }
      registrationIds.push(registration.id);
    }

    // Build Stripe line items
    let sessionDescription: string;
    if (isSingleMode) {
      const slot = partner.sessions[0]?.morning;
      sessionDescription = `${slot?.ageRange || 'Ages 3–6'}`;
      if (validated.selectedLocation) {
        const loc = partner.locations?.find(l => l.slug === validated.selectedLocation);
        if (loc) sessionDescription += ` · ${loc.name}`;
      }
    } else {
      sessionDescription = validated.selectedSessionType === 'morning'
        ? 'Morning Session (Ages 4–6) · 10:00–11:00 AM'
        : 'Afternoon Session (Ages 7–9) · 1:00–3:00 PM';
    }

    // For series enrollment, create a single line item for the full series
    const isSeriesEnrollment = partner.enrollmentMode === 'series';
    const lineItems: Array<{
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    }> = isSeriesEnrollment
      ? [{
          price_data: {
            currency: partner.pricing.currency,
            product_data: {
              name: `${partner.name} — Series 1`,
              description: `${sessionDescription} · ${validated.selectedWorkshopIds.length} sessions`,
            },
            unit_amount: unitAmount * validated.selectedWorkshopIds.length,
          },
          quantity: numberOfChildren,
        }]
      : validated.selectedWorkshopIds.map((workshopId) => {
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
            quantity: numberOfChildren,
          };
        });

    // Add WA state sales tax as a separate line item (ESSB 5814)
    if (taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: partner.pricing.currency,
          product_data: {
            name: 'WA Sales Tax',
            description: `Washington state sales tax (${(taxRate * 100).toFixed(1)}%)`,
          },
          unit_amount: taxAmount,
        },
        quantity: 1,
      });
    }

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
      success_url: `${appUrl}/workshops/register?registration=success&session_id={CHECKOUT_SESSION_ID}&partner=${validated.partnerId}`,
      cancel_url: `${appUrl}/workshops/register?registration=cancelled&partner=${validated.partnerId}`,
      allow_promotion_codes: true,
      metadata: {
        registration_id: registrationIds[0],
        registration_ids: registrationIds.join(','),
        partner_id: validated.partnerId,
        type: 'workshop',
        children_count: String(numberOfChildren),
        location: validated.selectedLocation || '',
        tax_rate: taxRate > 0 ? String(taxRate) : '',
        tax_amount: taxAmount > 0 ? String(taxAmount) : '',
      },
    });

    // Update all registrations with Stripe session ID
    await supabaseAdmin
      .from('workshop_registrations')
      .update({ stripe_checkout_session_id: checkoutSession.id })
      .in('id', registrationIds);

    console.log('[WORKSHOP-CHECKOUT] Session created:', {
      registrationIds,
      sessionId: checkoutSession.id,
      subtotal: formatWorkshopPrice(totalAmount),
      tax: taxAmount > 0 ? formatWorkshopPrice(taxAmount) : '$0.00',
      taxRate: taxRate > 0 ? `${(taxRate * 100).toFixed(1)}%` : 'none',
      total: formatWorkshopPrice(totalAmount + taxAmount),
      workshopCount: validated.selectedWorkshopIds.length,
      childrenCount: numberOfChildren,
      partner: validated.partnerId,
      location: validated.selectedLocation || null,
      enrollmentMode: partner.enrollmentMode || 'individual',
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
