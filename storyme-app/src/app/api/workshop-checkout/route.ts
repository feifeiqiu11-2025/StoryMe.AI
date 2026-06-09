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
  getEnrollmentMode,
  getAfternoonEligibleSessions,
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
    if (!partner || partner.status !== 'active') {
      return NextResponse.json(
        { error: 'Invalid or unavailable partner program' },
        { status: 400 },
      );
    }

    const isSingleMode = partner.sessionMode === 'single';
    const sessionTypeForQuery = isSingleMode ? 'single' : validated.selectedSessionType;
    // Per-session-type enrollment mode (e.g. summer SteamOji: morning='topic-pair', afternoon='series')
    const currentEnrollmentMode = getEnrollmentMode(
      partner,
      sessionTypeForQuery as 'morning' | 'afternoon' | 'single',
    );

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

    // Validate time slot for partners with time slots.
    // Slot picker applies to:
    //   - single-mode partners with locations[].timeSlots (e.g. Avocado)
    //   - dual-mode singular-location partners for MORNING enrollment, whether
    //     individual OR topic-pair (e.g. summer SteamOji morning). Time slots are
    //     a morning-side artifact in the current partner config; afternoon series
    //     enrollment has no slots, so no slot validation is required there.
    //
    // This MUST mirror the front-end `showSlotPicker` (morning-only for singular
    // locations) and the availability RPC selection (`morningUsesSlots`). Gating on
    // `enrollmentMode === 'topic-pair'` was the bug: summer SteamOji morning is
    // `individual` but still uses slots, so checkout fell back to the slot-blind v1
    // count and summed BOTH time slots — producing false "fully booked" errors when
    // one slot was busy (the Week 2 11am case: open 11am slot blocked by a full 9:45am).
    const multiLocationHasSlots = partner.locations?.some(l => (l.timeSlots?.length ?? 0) > 0) ?? false;
    const singularLocationHasSlots = (partner.location?.timeSlots?.length ?? 0) > 0;
    const requiresSlotForThisRequest =
      multiLocationHasSlots ||
      (singularLocationHasSlots && sessionTypeForQuery === 'morning');

    if (requiresSlotForThisRequest) {
      if (!validated.selectedTimeSlot) {
        return NextResponse.json(
          { error: 'Time slot selection is required for this partner' },
          { status: 400 },
        );
      }
      const multiLoc = partner.locations?.find(l => l.slug === validated.selectedLocation);
      const slotsForRequest = multiLoc?.timeSlots || partner.location?.timeSlots;
      const validSlot = slotsForRequest?.find(ts => ts.slug === validated.selectedTimeSlot);
      if (!validSlot) {
        return NextResponse.json(
          { error: 'Invalid time slot selected' },
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

    // Afternoon "single session OR prorated package" mode (summer SteamOji
    // afternoon). Selected sessions must be afternoon-eligible (excludes the
    // intro/this-week Sundays flagged afternoonEnrollable:false) so a single
    // session can't be used to buy an otherwise-unavailable afternoon date.
    const isAfternoonPkgMode =
      !isSingleMode &&
      validated.selectedSessionType === 'afternoon' &&
      !!partner.afternoonProgram?.singleSessionOption;
    if (isAfternoonPkgMode) {
      const afternoonEligibleIds = new Set(
        getAfternoonEligibleSessions(partner).map((s) => s.id),
      );
      const ineligible = validated.selectedWorkshopIds.filter((id) => !afternoonEligibleIds.has(id));
      if (ineligible.length > 0) {
        return NextResponse.json(
          { error: 'Selected afternoon sessions are not available for enrollment', invalidSessions: ineligible },
          { status: 400 },
        );
      }
    }

    // Check spot availability before proceeding
    const supabaseAvailability = createServiceRoleClient();

    // Use v3 RPC (location + time slot aware) for any registration that requires
    // a slot. This includes single-mode partners (Avocado) and dual-mode
    // singular-location MORNING enrollment (summer SteamOji morning — individual
    // or topic-pair). Afternoon / slotless requests fall back to v1 RPC.
    // Both RPCs count PAID registrations only (pending checkouts don't hold a
    // slot — see 20260530 migration); v3 additionally scopes the count to the
    // selected time slot, so a busy 9:45am slot no longer blocks an open 11am slot.
    const useLocationRpc = requiresSlotForThisRequest;
    const rpcName = useLocationRpc
      ? 'get_workshop_registration_counts_v3'
      : 'get_workshop_registration_counts';

    const effectiveLocationSlug =
      validated.selectedLocation || partner.location?.slug || null;

    const rpcParams: Record<string, string | null> = {
      p_partner_id: validated.partnerId,
      p_session_type: sessionTypeForQuery,
    };
    if (useLocationRpc) {
      rpcParams.p_location = effectiveLocationSlug;
      rpcParams.p_time_slot = validated.selectedTimeSlot || null;
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

    // Detect bundle-pricing program (intro + series-package split — summer
    // SteamOji afternoon). When active, totals come from bundle prices, not
    // per-session × count.
    const programForBundle = !isSingleMode
      ? validated.selectedSessionType === 'afternoon'
        ? partner.afternoonProgram
        : partner.morningProgram
      : null;
    const isBundlePricing =
      !!programForBundle?.introPrice && !!programForBundle?.seriesPackagePrice;
    const enrollableForBundle = partner.sessions.filter((s) => s.enrollable !== false);
    const bundleIntroId = isBundlePricing ? enrollableForBundle[0]?.id : undefined;
    const bundleSeriesIds = isBundlePricing
      ? enrollableForBundle.slice(1).map((s) => s.id)
      : [];
    const introInRequest = !!(bundleIntroId && validated.selectedWorkshopIds.includes(bundleIntroId));
    const seriesInRequest =
      bundleSeriesIds.length > 0 &&
      bundleSeriesIds.every((id) => validated.selectedWorkshopIds.includes(id));

    // Afternoon single-or-package pricing: 2+ sessions = prorated package
    // ($65/session); a single session = standard afternoon rate ($70). Mirrors
    // the WorkshopRegistrationForm calculation.
    const afternoonPkgIsPackage =
      isAfternoonPkgMode && validated.selectedWorkshopIds.length > 1;
    const afternoonPkgPerSession = afternoonPkgIsPackage
      ? partner.afternoonProgram?.packagePricePerSession ?? unitAmount
      : unitAmount;

    const totalAmount = isAfternoonPkgMode
      ? validated.selectedWorkshopIds.length * afternoonPkgPerSession * numberOfChildren
      : isBundlePricing
        ? ((introInRequest ? programForBundle!.introPrice! : 0) +
            (seriesInRequest ? programForBundle!.seriesPackagePrice! : 0)) *
          numberOfChildren
        : validated.selectedWorkshopIds.length * unitAmount * numberOfChildren;

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
          emergency_contact_name: validated.emergencyContactName || null,
          emergency_contact_phone: validated.emergencyContactPhone || null,
          emergency_contact_relation: validated.emergencyContactRelation || null,
          partner_id: validated.partnerId,
          selected_workshop_ids: validated.selectedWorkshopIds,
          selected_session_type: sessionTypeForQuery,
          is_bundle: isAfternoonPkgMode
            ? validated.selectedWorkshopIds.length > 1
            : currentEnrollmentMode === 'series' || currentEnrollmentMode === 'topic-pair',
          location: effectiveLocationSlug,
          time_slot: validated.selectedTimeSlot || null,
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
        // Append time slot label if selected
        if (validated.selectedTimeSlot && loc?.timeSlots) {
          const ts = loc.timeSlots.find(t => t.slug === validated.selectedTimeSlot);
          if (ts) sessionDescription += ` · ${ts.label}`;
        }
      }
    } else {
      // Dual mode — prefer per-program config over hardcoded defaults
      const program = validated.selectedSessionType === 'morning'
        ? partner.morningProgram
        : partner.afternoonProgram;
      const programName = program?.name
        || (validated.selectedSessionType === 'morning' ? 'Morning Session' : 'Afternoon Session');
      const programAge = program?.ageLabel
        || (validated.selectedSessionType === 'morning' ? 'Ages 4–6' : 'Ages 7–9');
      const programTime = program?.timeLabel
        || (validated.selectedSessionType === 'morning' ? '10:00–11:00 AM' : '1:00–3:00 PM');
      sessionDescription = `${programName} (${programAge}) · ${programTime}`;
      // Append slot label for singular-location dual-mode partners (summer SteamOji morning)
      if (validated.selectedTimeSlot && partner.location?.timeSlots) {
        const ts = partner.location.timeSlots.find(t => t.slug === validated.selectedTimeSlot);
        if (ts) sessionDescription += ` · ${ts.label}`;
      }
    }

    // Bundle into a single Stripe line item when the registration is for a
    // series or topic-pair (both represent multi-session purchases). Individual
    // mode creates one line item per selected session. Bundle-pricing programs
    // (intro + series-package) are handled separately below.
    const isBundle =
      !isBundlePricing &&
      !isAfternoonPkgMode &&
      (currentEnrollmentMode === 'series' || currentEnrollmentMode === 'topic-pair');
    const bundleLabel = (() => {
      if (currentEnrollmentMode === 'series') {
        // Use program name when available; falls back to "Series 1" for Avocado
        const programName = validated.selectedSessionType === 'morning'
          ? partner.morningProgram?.name
          : partner.afternoonProgram?.name;
        return programName || 'Series 1';
      }
      // topic-pair: list topics covered
      const selectedSessions = partner.sessions.filter((s) =>
        validated.selectedWorkshopIds.includes(s.id),
      );
      const topicLabels = Array.from(
        new Set(selectedSessions.map((s) => s.topicLabel || s.topicId).filter(Boolean)),
      );
      return topicLabels.length > 0
        ? `Topic Pair${topicLabels.length > 1 ? 's' : ''}: ${topicLabels.join(', ')}`
        : 'Workshop Pair';
    })();
    type StripeLineItem = {
      price_data: {
        currency: string;
        product_data: { name: string; description?: string };
        unit_amount: number;
      };
      quantity: number;
    };

    let lineItems: StripeLineItem[];
    if (isAfternoonPkgMode) {
      // Afternoon single-or-package: one line item. Package = prorated
      // per-session rate × count; single = standard afternoon rate.
      const count = validated.selectedWorkshopIds.length;
      if (afternoonPkgIsPackage) {
        const pkgSessions = partner.sessions.filter((s) =>
          validated.selectedWorkshopIds.includes(s.id),
        );
        const first = pkgSessions[0]?.dateLabel;
        const last = pkgSessions[pkgSessions.length - 1]?.dateLabel;
        const rangeLabel = first && last ? `${first} → ${last}` : `${count} sessions`;
        lineItems = [{
          price_data: {
            currency: partner.pricing.currency,
            product_data: {
              name: `${partner.name} — Remaining Series (${count} sessions)`,
              description: `${sessionDescription} · ${rangeLabel}`,
            },
            unit_amount: afternoonPkgPerSession * count,
          },
          quantity: numberOfChildren,
        }];
      } else {
        const single = partner.sessions.find((s) => s.id === validated.selectedWorkshopIds[0]);
        lineItems = [{
          price_data: {
            currency: partner.pricing.currency,
            product_data: {
              name: `${partner.name} — Single Session`,
              description: `${sessionDescription} · ${single?.dateLabel || ''}`,
            },
            unit_amount: unitAmount,
          },
          quantity: numberOfChildren,
        }];
      }
    } else if (isBundlePricing && programForBundle) {
      // Bundle pricing: emit one line item per selected bundle (intro and/or series).
      lineItems = [];
      if (introInRequest && bundleIntroId) {
        const introSession = partner.sessions.find((s) => s.id === bundleIntroId);
        lineItems.push({
          price_data: {
            currency: partner.pricing.currency,
            product_data: {
              name: `${partner.name} — Preview Intro Session`,
              description: `${sessionDescription} · ${introSession?.dateLabel || ''} · half-price preview`,
            },
            unit_amount: programForBundle.introPrice!,
          },
          quantity: numberOfChildren,
        });
      }
      if (seriesInRequest) {
        const firstSeries = partner.sessions.find((s) => s.id === bundleSeriesIds[0]);
        const lastSeries = partner.sessions.find((s) => s.id === bundleSeriesIds[bundleSeriesIds.length - 1]);
        const rangeLabel = firstSeries && lastSeries
          ? `${firstSeries.dateLabel} → ${lastSeries.dateLabel}`
          : `${bundleSeriesIds.length} sessions`;
        lineItems.push({
          price_data: {
            currency: partner.pricing.currency,
            product_data: {
              name: `${partner.name} — 4-Session Commitment Package`,
              description: `${sessionDescription} · ${rangeLabel}`,
            },
            unit_amount: programForBundle.seriesPackagePrice!,
          },
          quantity: numberOfChildren,
        });
      }
    } else if (isBundle) {
      lineItems = [{
        price_data: {
          currency: partner.pricing.currency,
          product_data: {
            name: `${partner.name} — ${bundleLabel}`,
            description: `${sessionDescription} · ${validated.selectedWorkshopIds.length} sessions`,
          },
          unit_amount: unitAmount * validated.selectedWorkshopIds.length,
        },
        quantity: numberOfChildren,
      }];
    } else {
      lineItems = validated.selectedWorkshopIds.map((workshopId) => {
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
    }

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
        time_slot: validated.selectedTimeSlot || '',
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
      sessionType: sessionTypeForQuery,
      location: effectiveLocationSlug,
      timeSlot: validated.selectedTimeSlot || null,
      enrollmentMode: currentEnrollmentMode,
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
