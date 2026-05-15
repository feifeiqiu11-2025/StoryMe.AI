/**
 * WorkshopRegistrationForm Component
 *
 * Multi-step registration form for workshop sign-ups.
 * Uses React Hook Form + Zod for validation, Stripe for payment.
 *
 * Supports two enrollment modes:
 * - Individual (SteamOji): morning/afternoon picker + date checkboxes
 * - Series (Avocado): location picker + read-only series overview
 */

'use client';

import { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  WorkshopRegistrationSchema,
  type WorkshopRegistrationData,
} from '@/lib/workshops/schemas';
import {
  type WorkshopPartner,
  formatWorkshopPrice,
  getPartnerSessionPricing,
  getPartnerCapacity,
  getEnrollableSessions,
  getSessionDates,
  getEnrollmentMode,
  getTopicPairs,
} from '@/lib/workshops/constants';
import type { WorkshopAvailabilityData } from '@/lib/workshops/types';

interface WorkshopRegistrationFormProps {
  partner: WorkshopPartner;
  defaultSessionType?: 'morning' | 'afternoon' | 'single';
  availability?: WorkshopAvailabilityData | null;
  availabilityLoading?: boolean;
}

export default function WorkshopRegistrationForm({
  partner,
  defaultSessionType,
  availability,
  availabilityLoading,
}: WorkshopRegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showWaiverText, setShowWaiverText] = useState(false);

  // Local availability state — refetched when location/timeSlot changes (Avocado only)
  const [localAvailability, setLocalAvailability] = useState(availability ?? null);
  const [localAvailabilityLoading, setLocalAvailabilityLoading] = useState(availabilityLoading ?? false);

  // Mode detection
  const isSingleMode = partner.sessionMode === 'single';
  const hasLocations = (partner.locations?.length ?? 0) > 0;

  // Per-program (session-type-aware) enrollment mode lookup. Falls back to
  // partner.enrollmentMode when no per-program override is set. Used for
  // dual-mode partners where morning/afternoon can use different enrollment
  // patterns (e.g. summer SteamOji: morning=topic-pair, afternoon=series).
  // For single-mode partners, always returns the partner-level mode.
  const partnerLevelEnrollmentMode = partner.enrollmentMode || 'individual';

  // For series mode, get all enrollable sessions across both series.
  // Past-week filtering (based on selected location's date schedule) happens
  // separately so the UI can render past sessions with line-through.
  const allEnrollableSessions = getEnrollableSessions(partner);
  const series1Sessions = allEnrollableSessions.filter((s) => s.series === 1);
  const series2Sessions = allEnrollableSessions.filter((s) => s.series === 2);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<WorkshopRegistrationData>({
    resolver: zodResolver(WorkshopRegistrationSchema) as any,
    defaultValues: {
      partnerId: partner.id,
      // Selection is finalized in the location/date useEffect below; start empty
      // for series mode so we don't pre-select past sessions before location loads.
      selectedWorkshopIds: [],
      selectedSessionType: isSingleMode
        ? 'single'
        : (defaultSessionType as 'morning' | 'afternoon') || undefined,
      selectedLocation: hasLocations ? partner.locations![0].slug : undefined,
      selectedTimeSlot: undefined,
      parentFirstName: '',
      parentLastName: '',
      parentEmail: '',
      parentPhone: '',
      children: [
        { firstName: '', lastName: '', age: undefined as unknown as number },
      ],
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      waiverAccepted: undefined as unknown as true,
      codeOfConductAccepted: false,
      photoVideoConsentAccepted: false,
    },
  });

  const {
    fields: childrenFields,
    append: addChild,
    remove: removeChild,
  } = useFieldArray({
    control,
    name: 'children',
  });

  const selectedWorkshopIds = watch('selectedWorkshopIds');
  const selectedSessionType = watch('selectedSessionType');
  const selectedLocation = watch('selectedLocation');
  const selectedTimeSlot = watch('selectedTimeSlot');

  // Session-type-aware enrollment mode lookup (e.g. summer SteamOji has
  // morning=topic-pair, afternoon=series). Falls back to partner.enrollmentMode.
  const sessionTypeForMode: 'morning' | 'afternoon' | 'single' = isSingleMode
    ? 'single'
    : (selectedSessionType as 'morning' | 'afternoon') || 'morning';
  const currentEnrollmentMode = getEnrollmentMode(partner, sessionTypeForMode);
  const isSeriesMode = currentEnrollmentMode === 'series';
  const isTopicPairMode = currentEnrollmentMode === 'topic-pair';
  void partnerLevelEnrollmentMode; // referenced for clarity above

  // Sessions considered for series UI (filters out enrollable: false rows).
  const enrollableSessions = isSeriesMode ? allEnrollableSessions : [];

  // Topic pairs for topic-pair enrollment mode (e.g. summer SteamOji morning).
  const topicPairs = isTopicPairMode ? getTopicPairs(partner) : [];

  // Clear selectedWorkshopIds when the session type changes so stale IDs from
  // a previous tab (e.g. afternoon series auto-select) don't bleed into the
  // morning topic-pair UI. Declared BEFORE the series-mode auto-select so the
  // autoselect's setValue runs last and wins when entering series mode.
  useEffect(() => {
    setValue('selectedWorkshopIds', [], { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionType]);

  // Auto-select all FUTURE enrollable sessions for series mode.
  // Recomputed when the selected location changes (Bellevue/Kirkland have
  // different date schedules so future-vs-past differs by location).
  useEffect(() => {
    if (!isSeriesMode || enrollableSessions.length === 0) return;
    // For Avocado (multi-location), use the location's date schedule. For
    // single-location dual-mode partners (summer SteamOji afternoon), use
    // partner.location.
    const loc = hasLocations
      ? (selectedLocation ? partner.locations?.find((l) => l.slug === selectedLocation) : undefined)
      : partner.location;
    const dates = loc ? getSessionDates(loc, enrollableSessions.length) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const futureIds = enrollableSessions
      .filter((_, idx) => {
        if (!dates) return true; // no location → keep all enrollable selected
        const iso = dates[idx]?.date;
        if (!iso) return true;
        const sessionDate = new Date(iso + 'T00:00:00');
        // Strictly future — same-day registration isn't accepted since the
        // session is already starting by the time enrollment processes.
        return sessionDate > today;
      })
      .map((s) => s.id);

    setValue('selectedWorkshopIds', futureIds, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSeriesMode, selectedLocation, enrollableSessions.length, selectedSessionType]);

  // Auto-set session type for single mode
  useEffect(() => {
    if (isSingleMode) {
      setValue('selectedSessionType', 'single');
    }
  }, [isSingleMode, setValue]);

  // Time slots are available if either multi-location (Avocado) or singular
  // location (SteamOji summer) defines them.
  const hasTimeSlots =
    (partner.locations?.some(l => (l.timeSlots?.length ?? 0) > 0) ?? false) ||
    ((partner.location?.timeSlots?.length ?? 0) > 0);

  // For dual-mode partners with singular-location slots, we currently only
  // surface the slot picker for topic-pair enrollment (i.e. summer SteamOji
  // morning). Series-mode afternoon does not use a slot picker.
  const showSlotPicker = hasTimeSlots && (
    hasLocations // multi-location series (Avocado) always shows the picker
      ? !!selectedLocation
      : isTopicPairMode // singular-location dual (SteamOji summer) only for topic-pair
  );

  // Effective location slug — multi-location partners use selection; singular
  // location partners use partner.location.slug.
  const effectiveLocationSlug = hasLocations
    ? selectedLocation
    : partner.location?.slug;

  // Refetch availability when location or time slot changes (slot-aware partners)
  useEffect(() => {
    if (!hasTimeSlots) return;
    // Only refetch when a time slot is selected
    if (!selectedTimeSlot) {
      setLocalAvailability(null);
      return;
    }
    if (!effectiveLocationSlug) return;
    let cancelled = false;
    setLocalAvailabilityLoading(true);
    const url = `/api/v1/workshops/availability?partnerId=${partner.id}&location=${effectiveLocationSlug}&timeSlot=${selectedTimeSlot}` +
      (isSingleMode ? '' : `&sessionType=${sessionTypeForMode}`);
    fetch(url)
      .then(res => res.json())
      .then(json => {
        if (!cancelled && json.success && json.data) {
          setLocalAvailability(json.data);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLocalAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [hasTimeSlots, partner.id, effectiveLocationSlug, selectedTimeSlot, isSingleMode, sessionTypeForMode]);

  // Pricing — use helpers for correct mode handling
  const sessionPricing = getPartnerSessionPricing(
    partner,
    isSingleMode
      ? 'single'
      : (selectedSessionType as 'morning' | 'afternoon' | undefined),
  );
  const pricePerSession = sessionPricing?.promoPrice || 0;
  const originalPricePerSession = sessionPricing?.originalPrice || 0;
  const hasDiscount =
    pricePerSession > 0 && pricePerSession < originalPricePerSession;

  const workshopCount = selectedWorkshopIds?.length || 0;
  const numberOfChildren = childrenFields.length;

  // Session type key for availability / capacity
  const sessionTypeKey = isSingleMode
    ? 'single'
    : selectedSessionType || 'morning';

  // Bundle pricing for dual-mode series with intro + series-package split
  // (e.g. summer SteamOji afternoon: $35 intro + $250 series package).
  // When introPrice and seriesPackagePrice are both set on the relevant program,
  // total is computed from which bundles the user selected, not per-session.
  const programWithBundlePricing =
    sessionTypeKey === 'afternoon'
      ? partner.afternoonProgram
      : sessionTypeKey === 'morning'
        ? partner.morningProgram
        : null;
  const isBundlePricing =
    !isSingleMode &&
    !!programWithBundlePricing?.introPrice &&
    !!programWithBundlePricing?.seriesPackagePrice;
  const bundleIntroId = isBundlePricing ? allEnrollableSessions[0]?.id : undefined;
  const bundleSeriesIds = isBundlePricing
    ? allEnrollableSessions.slice(1).map((s) => s.id)
    : [];
  const bundleIntroSelected = !!(
    bundleIntroId && selectedWorkshopIds?.includes(bundleIntroId)
  );
  const bundleSeriesSelected =
    bundleSeriesIds.length > 0 &&
    bundleSeriesIds.every((id) => selectedWorkshopIds?.includes(id));

  // Base per-session math (used by non-bundle modes and as a fallback)
  const perSessionTotalPrice =
    workshopCount * pricePerSession * numberOfChildren;
  const bundleTotalPrice = isBundlePricing
    ? ((bundleIntroSelected ? programWithBundlePricing!.introPrice! : 0) +
        (bundleSeriesSelected
          ? programWithBundlePricing!.seriesPackagePrice!
          : 0)) *
      numberOfChildren
    : null;
  const totalPrice = bundleTotalPrice ?? perSessionTotalPrice;
  const totalOriginal =
    workshopCount * originalPricePerSession * numberOfChildren;

  // Sales tax — WA state requires tax on enrichment workshops (ESSB 5814).
  // Reads from the selected location for multi-location partners (Avocado) and
  // falls back to the singular location's taxRate for partners like SteamOji.
  const selectedLocationData = hasLocations && selectedLocation
    ? partner.locations!.find((l) => l.slug === selectedLocation)
    : null;
  const taxRate =
    selectedLocationData?.taxRate ?? partner.location?.taxRate ?? 0;
  const taxAmount = Math.round(totalPrice * taxRate);
  const totalWithTax = totalPrice + taxAmount;

  // Check if a session date has passed (same-day counts as past — can't register day-of)
  const isSessionPast = (dateLabel: string): boolean => {
    const sessionDate = new Date(dateLabel);
    if (isNaN(sessionDate.getTime())) return false; // "Week 1" etc. won't parse
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessionDate <= today;
  };

  // Spot availability helper — uses local availability for time-slot partners, prop for others
  const effectiveAvailability = hasTimeSlots ? localAvailability : availability;
  const effectiveLoading = hasTimeSlots ? localAvailabilityLoading : availabilityLoading;
  const getSpotsLeft = (sessionId: string): number | null => {
    if (!effectiveAvailability || effectiveLoading) return null;
    const countData = effectiveAvailability.counts[sessionId];
    if (!countData) return null;
    const count = isSingleMode
      ? (countData.single ?? 0)
      : (countData[sessionTypeKey as 'morning' | 'afternoon'] ?? 0);
    const capacity = getPartnerCapacity(
      partner,
      sessionTypeKey as 'morning' | 'afternoon' | 'single',
      selectedLocation || undefined,
    );
    return Math.max(0, capacity - count);
  };

  // Toggle workshop selection (individual mode)
  const toggleWorkshop = (workshopId: string) => {
    const current = selectedWorkshopIds || [];
    const updated = current.includes(workshopId)
      ? current.filter((id) => id !== workshopId)
      : [...current, workshopId];
    setValue('selectedWorkshopIds', updated, { shouldValidate: true });
  };

  // Select all available workshops (individual mode)
  const selectAll = () => {
    const availableIds = partner.sessions
      .filter((s) => {
        if (s.enrollable === false) return false;
        if (isSessionPast(s.dateLabel)) return false;
        const spots = getSpotsLeft(s.id);
        return spots === null || spots > 0;
      })
      .map((s) => s.id);
    setValue('selectedWorkshopIds', availableIds, { shouldValidate: true });
  };

  // Clear all selections (individual mode)
  const clearAll = () => {
    setValue('selectedWorkshopIds', [], { shouldValidate: true });
  };

  const onSubmit = async (data: WorkshopRegistrationData): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Non-school partners require emergency contact
      if (!isSingleMode) {
        if (!data.emergencyContactName || data.emergencyContactName.trim().length === 0) {
          throw new Error('Emergency contact name is required.');
        }
        if (!data.emergencyContactPhone || data.emergencyContactPhone.trim().length < 10) {
          throw new Error('Please enter a valid emergency contact phone number.');
        }
        if (!data.emergencyContactRelation || data.emergencyContactRelation.trim().length === 0) {
          throw new Error('Emergency contact relationship is required.');
        }
      }

      // SteamOji requires Code of Conduct (any program: spring 'steamoji', summer 'steamoji-summer-2026', etc.)
      if (partner.id.startsWith('steamoji') && !data.codeOfConductAccepted) {
        throw new Error('You must accept the Code of Conduct to register for SteamOji workshops.');
      }

      // Slot picker partners require a time slot selection
      if (showSlotPicker && !data.selectedTimeSlot) {
        throw new Error('Please select a time slot before registering.');
      }

      const response = await fetch('/api/workshop-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 409 && result.code === 'SESSIONS_FULL') {
          const fullNames = (result.fullSessions as string[])
            .map((id: string) => {
              const idx = partner.sessions.findIndex((s) => s.id === id);
              return idx >= 0 ? `Week ${idx + 1}` : id;
            })
            .join(', ');
          throw new Error(
            `The following sessions are now fully booked: ${fullNames}. Please deselect them and try again.`,
          );
        }
        throw new Error(result.error || 'Failed to create checkout session');
      }

      if (result.url) {
        window.location.href = result.url;
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
      );
      setIsSubmitting(false);
    }
  };

  const inputClassName =
    'w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-base';
  const labelClassName = 'block text-sm font-medium text-gray-700 mb-1';
  const errorClassName = 'text-red-500 text-sm mt-1';

  const sessionTimeLabel =
    sessionTypeKey === 'morning'
      ? partner.morningProgram?.timeLabel || '10:00 – 11:00 AM (1 hr)'
      : sessionTypeKey === 'afternoon'
        ? partner.afternoonProgram?.timeLabel || '1:00 – 3:00 PM (2 hrs)'
        : '';

  return (
    <form onSubmit={handleSubmit(onSubmit, (fieldErrors) => {
      // Scroll to first error field — inline errors render next to each field already
      const firstErrorKey = Object.keys(fieldErrors)[0];
      if (firstErrorKey) {
        const el = document.querySelector(`[name="${firstErrorKey}"]`) || document.querySelector(`[name^="${firstErrorKey}"]`);
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })} className="space-y-8">
      {/* Hidden fields */}
      <input type="hidden" {...register('partnerId')} />
      {isSingleMode && (
        <input type="hidden" {...register('selectedSessionType')} />
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section 1 — Series: Location Picker / Dual: Session Type */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isSeriesMode && hasLocations ? (
        /* --- SERIES + LOCATIONS: Choose Location --- */
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            1. Choose Your Location
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {partner.locations!.map((loc) => (
              <label
                key={loc.slug}
                className={`relative flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  selectedLocation === loc.slug
                    ? 'border-amber-500 bg-amber-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  value={loc.slug}
                  {...register('selectedLocation')}
                  className="sr-only peer"
                />
                <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedLocation === loc.slug
                    ? 'bg-amber-500 border-amber-500'
                    : 'border-gray-300 bg-white'
                }`}>
                  {selectedLocation === loc.slug && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div>
                  <span className="text-base font-semibold text-gray-900">
                    {loc.name}
                  </span>
                  {loc.address && loc.address !== 'TBD' && (
                    <p className="text-sm text-gray-500">{loc.address}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          {errors.selectedLocation && (
            <p className={errorClassName} role="alert">
              {errors.selectedLocation.message}
            </p>
          )}

          {/* Time Slot Picker — only for partners with time slots */}
          {(() => {
            const loc = partner.locations!.find(l => l.slug === selectedLocation);
            if (!loc?.timeSlots?.length) return null;
            const dayName = loc.dayOfWeek ? loc.dayOfWeek.charAt(0).toUpperCase() + loc.dayOfWeek.slice(1) + 's' : '';
            return (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  2. Choose Your Time Slot
                </h3>
                {dayName && (
                  <p className="mb-3 text-sm text-amber-700">
                    Sessions held every <span className="font-semibold">{dayName}</span>
                    {loc.skipDates?.length ? ' (except spring break)' : ''}
                  </p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {loc.timeSlots.map((ts) => (
                    <label
                      key={ts.slug}
                      className={`relative flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        selectedTimeSlot === ts.slug
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        value={ts.slug}
                        {...register('selectedTimeSlot')}
                        className="sr-only peer"
                      />
                      <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedTimeSlot === ts.slug
                          ? 'bg-amber-500 border-amber-500'
                          : 'border-gray-300 bg-white'
                      }`}>
                        {selectedTimeSlot === ts.slug && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-base font-semibold text-gray-900">
                        {ts.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : !isSingleMode ? (
        /* --- DUAL MODE: Morning / Afternoon Session Picker --- */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              1. Choose Your Session
            </h3>
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
              Limited to{' '}
              {partner.capacity[sessionTypeKey as 'morning' | 'afternoon']}{' '}
              spots per session
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label
              className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedSessionType === 'morning'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value="morning"
                {...register('selectedSessionType')}
                className="sr-only"
              />
              <span className="text-lg font-semibold text-gray-900">
                Morning Session
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {partner.morningProgram?.ageLabel || 'Ages 4–6'} · {partner.morningProgram?.timeLabel || '10:00 – 11:00 AM · 1 hour'}
              </span>
              <div className="mt-2">
                {hasDiscount && selectedSessionType === 'morning' ? (
                  <span className="text-sm">
                    {partner.pricing.morning.originalPrice > partner.pricing.morning.promoPrice && (
                      <span className="line-through text-gray-400 mr-1">
                        {formatWorkshopPrice(
                          partner.pricing.morning.originalPrice,
                        )}
                      </span>
                    )}
                    <span className="font-bold text-amber-700">
                      {formatWorkshopPrice(partner.pricing.morning.promoPrice)}
                    </span>
                    <span className="text-gray-500"> / session</span>
                  </span>
                ) : (
                  <span className="text-sm">
                    {partner.pricing.morning.originalPrice > partner.pricing.morning.promoPrice && (
                      <span className="line-through text-gray-400 mr-1">
                        {formatWorkshopPrice(
                          partner.pricing.morning.originalPrice,
                        )}
                      </span>
                    )}
                    <span className="font-semibold text-gray-700">
                      {formatWorkshopPrice(partner.pricing.morning.promoPrice)}
                    </span>
                    <span className="text-gray-500"> / session</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {partner.morningProgram?.shortDescription ||
                  'Turn imagination into story characters, make physical books, show & tell'}
              </p>
            </label>

            <label
              className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
                selectedSessionType === 'afternoon'
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                value="afternoon"
                {...register('selectedSessionType')}
                className="sr-only"
              />
              <span className="text-lg font-semibold text-gray-900">
                Afternoon Session
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {partner.afternoonProgram?.ageLabel || 'Ages 7–12'} · {partner.afternoonProgram?.timeLabel || '1:00 – 3:00 PM · 2 hours'}
              </span>
              <div className="mt-2">
                {hasDiscount && selectedSessionType === 'afternoon' ? (
                  <span className="text-sm">
                    {partner.pricing.afternoon.originalPrice > partner.pricing.afternoon.promoPrice && (
                      <span className="line-through text-gray-400 mr-1">
                        {formatWorkshopPrice(
                          partner.pricing.afternoon.originalPrice,
                        )}
                      </span>
                    )}
                    <span className="font-bold text-indigo-700">
                      {formatWorkshopPrice(
                        partner.pricing.afternoon.promoPrice,
                      )}
                    </span>
                    <span className="text-gray-500"> / session</span>
                  </span>
                ) : (
                  <span className="text-sm">
                    {partner.pricing.afternoon.originalPrice > partner.pricing.afternoon.promoPrice && (
                      <span className="line-through text-gray-400 mr-1">
                        {formatWorkshopPrice(
                          partner.pricing.afternoon.originalPrice,
                        )}
                      </span>
                    )}
                    <span className="font-semibold text-gray-700">
                      {formatWorkshopPrice(
                        partner.pricing.afternoon.promoPrice,
                      )}
                    </span>
                    <span className="text-gray-500"> / session</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-2">
                {partner.afternoonProgram?.shortDescription ||
                  'Nature exploration, creative thinking & story making'}
              </p>
            </label>
          </div>
          {errors.selectedSessionType && (
            <p className={errorClassName} role="alert">
              {errors.selectedSessionType.message}
            </p>
          )}

          {/* Location info — shown after session selection (single-location partners) */}
          {selectedSessionType && partner.location && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm">
              <div className="flex items-center gap-2 text-gray-700">
                <svg
                  className="w-4 h-4 text-blue-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>
                  <span className="font-medium">Workshop Location:</span>{' '}
                  {partner.location.mapUrl ? (
                    <a
                      href={partner.location.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 underline"
                    >
                      {partner.location.name}, {partner.location.address}
                    </a>
                  ) : (
                    `${partner.location.name}, ${partner.location.address}`
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Slot picker — singular-location partners (e.g. summer SteamOji morning).
              Multi-location series partners (Avocado) have their slot picker
              inside the location block above. */}
          {showSlotPicker && !hasLocations && partner.location?.timeSlots && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                2. Choose Your Time Slot
              </h3>
              <p className="mb-3 text-sm text-amber-700">
                Pick one time slot — your child attends every session at the slot you choose.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {partner.location.timeSlots.map((ts) => (
                  <label
                    key={ts.slug}
                    className={`relative flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selectedTimeSlot === ts.slug
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      value={ts.slug}
                      {...register('selectedTimeSlot')}
                      className="sr-only peer"
                    />
                    <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      selectedTimeSlot === ts.slug
                        ? 'bg-amber-500 border-amber-500'
                        : 'border-gray-300 bg-white'
                    }`}>
                      {selectedTimeSlot === ts.slug && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className="text-base font-semibold text-gray-900">
                      {ts.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section — Topic Pair / Series Overview / Workshop Dates */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isTopicPairMode ? (
        /* --- TOPIC PAIR MODE: One card per topic, each topic = a pair of sessions --- */
        (() => {
          const loc = hasLocations
            ? (selectedLocation ? partner.locations?.find((l) => l.slug === selectedLocation) : undefined)
            : partner.location;
          const allDates = loc ? getSessionDates(loc, partner.sessions.length) : null;
          const dateByIndex = (idx: number): string =>
            allDates?.[idx]?.formatted || partner.sessions[idx]?.dateLabel || '';

          const togglePair = (pairSessionIds: string[]) => {
            const current = selectedWorkshopIds || [];
            const allOn = pairSessionIds.every((id) => current.includes(id));
            const next = allOn
              ? current.filter((id) => !pairSessionIds.includes(id))
              : Array.from(new Set([...current, ...pairSessionIds]));
            setValue('selectedWorkshopIds', next, { shouldValidate: true });
          };

          return (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {showSlotPicker ? '3' : '2'}. Choose Your Topic{topicPairs.length > 1 ? 's' : ''}
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Each topic is sold as a 2-session pair — first session sparks the story with drama play and craft, the next session produces a printed storybook.
              </p>
              <div className="space-y-3">
                {topicPairs.map((pair) => {
                  const ids = pair.sessions.map((s) => s.id);
                  const allOn = ids.length > 0 && ids.every((id) => selectedWorkshopIds?.includes(id));
                  const pairPrice = pricePerSession * ids.length;
                  const sessionsWithIdx = pair.sessions.map((s) => ({
                    session: s,
                    globalIdx: partner.sessions.findIndex((p) => p.id === s.id),
                  }));
                  // First session in the pair carries the learning-outcome description for the topic.
                  const topicDescription = pair.sessions[0]?.themeDescription;
                  return (
                    <label
                      key={pair.topicId}
                      className={`block p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        allOn
                          ? 'border-amber-500 bg-amber-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={allOn}
                        onChange={() => togglePair(ids)}
                        className="sr-only"
                      />
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            allOn ? 'bg-amber-600 border-amber-600' : 'border-gray-300 bg-white'
                          }`}>
                            {allOn && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900">{pair.topicLabel}</div>
                            <div className="text-sm text-gray-500">
                              {ids.length} sessions · 1 printed storybook
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-sm">
                          <div className="font-semibold text-gray-900">
                            {formatWorkshopPrice(pairPrice)}
                          </div>
                          <div className="text-xs text-gray-500">per child · pair</div>
                        </div>
                      </div>
                      {topicDescription && (
                        <p className="mt-2 ml-8 text-sm text-gray-600 leading-relaxed">
                          {topicDescription}
                        </p>
                      )}
                      <ul className="mt-3 ml-8 space-y-1 text-sm text-gray-600">
                        {sessionsWithIdx.map(({ session, globalIdx }) => (
                          <li key={session.id} className="flex items-center gap-2">
                            <span className="text-amber-500">•</span>
                            <span className="font-medium text-gray-700">
                              {dateByIndex(globalIdx)}
                            </span>
                            <span className="text-gray-500">— {session.morning.title}</span>
                          </li>
                        ))}
                      </ul>
                    </label>
                  );
                })}
              </div>

              {errors.selectedWorkshopIds && (
                <p className={errorClassName} role="alert">
                  {errors.selectedWorkshopIds.message}
                </p>
              )}

              {workshopCount > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {numberOfChildren > 1
                          ? `Subtotal · ${numberOfChildren} children × ${workshopCount} session${workshopCount !== 1 ? 's' : ''}`
                          : `Subtotal · ${workshopCount} session${workshopCount !== 1 ? 's' : ''}`}
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatWorkshopPrice(totalPrice)}
                      </span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Sales tax ({(taxRate * 100).toFixed(1)}%)
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatWorkshopPrice(taxAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatWorkshopPrice(totalWithTax)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : isSeriesMode && isBundlePricing ? (
        /* --- BUNDLE PRICING (intro + series package) — e.g. summer SteamOji afternoon --- */
        (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const introSession = allEnrollableSessions[0];
          const seriesSessions = allEnrollableSessions.slice(1);
          const intro = programWithBundlePricing!;
          const introDateObj = introSession ? new Date(introSession.dateLabel) : null;
          const introIsPast = !!introDateObj && !isNaN(introDateObj.getTime()) && (introDateObj.setHours(0, 0, 0, 0), introDateObj.getTime() <= today.getTime());
          const seriesFirstDateObj = seriesSessions[0] ? new Date(seriesSessions[0].dateLabel) : null;
          const seriesLastDateObj = seriesSessions[seriesSessions.length - 1] ? new Date(seriesSessions[seriesSessions.length - 1].dateLabel) : null;
          const seriesIsAllPast =
            seriesSessions.length > 0 &&
            seriesSessions.every((s) => {
              const d = new Date(s.dateLabel);
              if (isNaN(d.getTime())) return false;
              d.setHours(0, 0, 0, 0);
              return d.getTime() <= today.getTime();
            });

          const toggleIntro = () => {
            if (!bundleIntroId || introIsPast) return;
            const cur = selectedWorkshopIds || [];
            setValue(
              'selectedWorkshopIds',
              bundleIntroSelected
                ? cur.filter((id) => id !== bundleIntroId)
                : [...cur, bundleIntroId],
              { shouldValidate: true },
            );
          };
          const toggleSeriesPackage = () => {
            if (seriesIsAllPast || bundleSeriesIds.length === 0) return;
            const cur = selectedWorkshopIds || [];
            setValue(
              'selectedWorkshopIds',
              bundleSeriesSelected
                ? cur.filter((id) => !bundleSeriesIds.includes(id))
                : Array.from(new Set([...cur, ...bundleSeriesIds])),
              { shouldValidate: true },
            );
          };

          const seriesDateRange =
            seriesFirstDateObj && seriesLastDateObj && !isNaN(seriesFirstDateObj.getTime()) && !isNaN(seriesLastDateObj.getTime())
              ? `${seriesFirstDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${seriesLastDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              : 'Jun 7 – Jun 28';

          return (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {hasTimeSlots ? '3' : '2'}. Choose Your Enrollment
              </h3>
              <p className="mb-4 text-sm text-gray-600">
                Try the preview, commit to the full series, or both. Check both for the full Chapter Book journey.
              </p>

              <div className="space-y-3">
                {/* Intro Preview bundle */}
                {introSession && (
                  <label
                    className={`block p-4 border-2 rounded-xl transition-all ${
                      introIsPast
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                        : bundleIntroSelected
                          ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bundleIntroSelected}
                      disabled={introIsPast}
                      onChange={toggleIntro}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          introIsPast
                            ? 'bg-gray-200 border-gray-300'
                            : bundleIntroSelected
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-gray-300 bg-white'
                        }`}>
                          {bundleIntroSelected && !introIsPast && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            Preview Intro Session
                          </div>
                          <div className="text-sm text-gray-500">
                            {introSession.dateLabel} · half-price preview
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>
                          <span className="line-through text-gray-400 mr-1">
                            {formatWorkshopPrice(originalPricePerSession)}
                          </span>
                          <span className="font-semibold text-indigo-700">
                            {formatWorkshopPrice(intro.introPrice!)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">per child</div>
                      </div>
                    </div>
                    <p className="mt-2 ml-8 text-sm text-gray-600 leading-relaxed">
                      A sample workshop session so kids and families can experience the format and decide whether to commit to the 4-session chapter book series.
                    </p>
                  </label>
                )}

                {/* Series Package bundle */}
                {seriesSessions.length > 0 && (
                  <label
                    className={`block p-4 border-2 rounded-xl transition-all ${
                      seriesIsAllPast
                        ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                        : bundleSeriesSelected
                          ? 'border-indigo-500 bg-indigo-50 cursor-pointer'
                          : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={bundleSeriesSelected}
                      disabled={seriesIsAllPast}
                      onChange={toggleSeriesPackage}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          seriesIsAllPast
                            ? 'bg-gray-200 border-gray-300'
                            : bundleSeriesSelected
                              ? 'bg-indigo-600 border-indigo-600'
                              : 'border-gray-300 bg-white'
                        }`}>
                          {bundleSeriesSelected && !seriesIsAllPast && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">
                            Full 4-Session Commitment Package
                          </div>
                          <div className="text-sm text-gray-500">
                            {seriesDateRange} · {seriesSessions.length} sessions · printed chapter book
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div>
                          <span className="line-through text-gray-400 mr-1">
                            {formatWorkshopPrice(originalPricePerSession * seriesSessions.length)}
                          </span>
                          <span className="font-semibold text-indigo-700">
                            {formatWorkshopPrice(intro.seriesPackagePrice!)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500">per child · package</div>
                      </div>
                    </div>
                    <ul className="mt-3 ml-8 space-y-1 text-sm text-gray-600">
                      {seriesSessions.map((session) => (
                        <li key={session.id} className="flex items-center gap-2">
                          <span className="text-indigo-500">•</span>
                          <span className="font-medium text-gray-700">{session.dateLabel}</span>
                          <span className="text-gray-500">— {session.afternoon?.title || session.theme}</span>
                        </li>
                      ))}
                    </ul>
                  </label>
                )}
              </div>

              {errors.selectedWorkshopIds && (
                <p className={errorClassName} role="alert">
                  {errors.selectedWorkshopIds.message}
                </p>
              )}

              {totalPrice > 0 && (
                <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {numberOfChildren > 1
                          ? `Subtotal · ${numberOfChildren} children`
                          : 'Subtotal'}
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatWorkshopPrice(totalPrice)}
                      </span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Sales tax ({(taxRate * 100).toFixed(1)}%)
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatWorkshopPrice(taxAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-gray-200">
                      <span className="text-sm font-semibold text-gray-800">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatWorkshopPrice(totalWithTax)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()
      ) : isSeriesMode ? (
        /* --- SERIES MODE: Two enrollable series w/ past-week strikethrough --- */
        (() => {
          // Multi-location partners (Avocado) use selected location's schedule;
          // singular-location partners (summer SteamOji afternoon) use partner.location.
          const loc = hasLocations
            ? (selectedLocation ? partner.locations?.find((l) => l.slug === selectedLocation) : undefined)
            : partner.location;
          const sessionDates = loc
            ? getSessionDates(loc, enrollableSessions.length)
            : null;

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isPastByGlobalIdx = (globalIdx: number): boolean => {
            const iso = sessionDates?.[globalIdx]?.date;
            if (!iso) return false;
            // Same-day counts as past — can't register day-of.
            return new Date(iso + 'T00:00:00') <= today;
          };

          const renderSessionRow = (
            session: typeof enrollableSessions[number],
            globalIdx: number,
          ) => {
            const isPast = isPastByGlobalIdx(globalIdx);
            const dateText = sessionDates?.[globalIdx]?.formatted || session.dateLabel;
            const isStorybookWeek = globalIdx % 2 === 1;
            const storybookNumber = Math.floor(globalIdx / 2) + 1;
            return (
              <div
                key={session.id}
                className={`flex items-start gap-3 p-3 rounded-lg ${
                  isPast ? 'bg-gray-50/60 opacity-60' : 'bg-white/70'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    isPast
                      ? 'bg-gray-200 text-gray-400'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {globalIdx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-medium ${
                        isPast ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}
                    >
                      {session.theme}
                    </span>
                    <span
                      className={`text-xs font-medium ${
                        isPast ? 'text-gray-400 line-through' : 'text-gray-600'
                      }`}
                    >
                      {dateText}
                    </span>
                  </div>
                  {session.themeDescription && (
                    <p
                      className={`text-sm mt-0.5 ${
                        isPast ? 'text-gray-400 line-through' : 'text-gray-500'
                      }`}
                    >
                      {session.themeDescription}
                    </p>
                  )}
                </div>
                {isStorybookWeek && (
                  <span
                    className={`flex-shrink-0 text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap ${
                      isPast
                        ? 'text-gray-400 bg-gray-100'
                        : 'text-amber-700 bg-amber-100/80'
                    }`}
                  >
                    Storybook {storybookNumber} produced
                  </span>
                )}
              </div>
            );
          };

          // Per-series toggle: future-only sessions in a series go in/out of selection
          const futureIdsForSeries = (sessions: typeof enrollableSessions): string[] => {
            return sessions
              .filter((s) => {
                const idx = enrollableSessions.findIndex((es) => es.id === s.id);
                return idx >= 0 && !isPastByGlobalIdx(idx);
              })
              .map((s) => s.id);
          };
          const series1FutureIds = futureIdsForSeries(series1Sessions);
          const series2FutureIds = futureIdsForSeries(series2Sessions);

          const allSelected = (ids: string[]): boolean =>
            ids.length > 0 && ids.every((id) => selectedWorkshopIds?.includes(id));

          const toggleSeries = (futureIds: string[], allSeriesIds: string[]) => {
            const current = selectedWorkshopIds || [];
            const isOn = allSelected(futureIds);
            // OFF: drop every session in this series (past or future, though past won't be in there anyway)
            // ON: add all future ids in this series
            const next = isOn
              ? current.filter((id) => !allSeriesIds.includes(id))
              : Array.from(new Set([...current, ...futureIds]));
            setValue('selectedWorkshopIds', next, { shouldValidate: true });
          };

          // Storybooks completed = pairs (spark, book) where BOTH are selected
          let storybooksCompleted = 0;
          for (let pair = 0; pair < Math.floor(enrollableSessions.length / 2); pair++) {
            const sparkId = enrollableSessions[pair * 2]?.id;
            const bookId = enrollableSessions[pair * 2 + 1]?.id;
            if (
              sparkId &&
              bookId &&
              selectedWorkshopIds?.includes(sparkId) &&
              selectedWorkshopIds?.includes(bookId)
            ) {
              storybooksCompleted += 1;
            }
          }

          const futureCount = workshopCount; // selectedWorkshopIds is future-only

          // Series blocks ordered with upcoming-first, completed-after,
          // so families see the currently-enrolling series at the top.
          const seriesBlocks: Array<{
            num: number;
            sessions: typeof enrollableSessions;
            futureIds: string[];
            label: string;
            globalStartIdx: number;
          }> = [
            {
              num: 1,
              sessions: series1Sessions,
              futureIds: series1FutureIds,
              label: 'Series 1: Core Life Skills',
              globalStartIdx: 0,
            },
            {
              num: 2,
              sessions: series2Sessions,
              futureIds: series2FutureIds,
              label: 'Series 2: Curious Minds',
              globalStartIdx: series1Sessions.length,
            },
          ];
          // Hide series with no future sessions — completed series clutter the
          // registration UI. Admin still sees full history elsewhere.
          const orderedSeriesBlocks = seriesBlocks
            .filter((s) => s.futureIds.length > 0)
            .sort((a, b) => a.num - b.num);

          return (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">
                {hasTimeSlots ? '3' : '2'}. Series Overview
              </h3>

              <div className="space-y-4">
                {orderedSeriesBlocks.map(({ num, sessions, futureIds, label, globalStartIdx }) => {
                  if (sessions.length === 0) return null;
                  const hasFuture = futureIds.length > 0;
                  const allOn = allSelected(futureIds);
                  const sessionIds = sessions.map((s) => s.id);
                  return (
                    <div
                      key={num}
                      className={`rounded-xl p-5 ${hasFuture ? 'bg-amber-50/50' : 'bg-gray-50/60 opacity-90'}`}
                    >
                      <div className="flex items-center justify-between mb-3 gap-3">
                        <label className={`flex items-start gap-3 ${!hasFuture ? 'opacity-60' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={allOn}
                            disabled={!hasFuture}
                            onChange={() => toggleSeries(futureIds, sessionIds)}
                            className="sr-only peer"
                            aria-label={`Toggle ${label} enrollment`}
                          />
                          <div className={`flex-shrink-0 w-5 h-5 mt-1 rounded border-2 flex items-center justify-center transition-colors ${
                            !hasFuture
                              ? 'border-gray-300 bg-gray-100'
                              : allOn
                              ? 'bg-amber-500 border-amber-500'
                              : 'border-gray-300 bg-white'
                          }`}>
                            {allOn && hasFuture && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">
                              {label}
                            </h4>
                            <p className="text-sm text-gray-600 mt-0.5">
                              {sessions.length} sessions · 35 mins each · {Math.floor(sessions.length / 2)} physical storybooks
                              {hasFuture && futureIds.length < sessions.length && (
                                <span className="ml-1.5 text-amber-700">
                                  · {futureIds.length} upcoming
                                </span>
                              )}
                            </p>
                          </div>
                        </label>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          hasFuture ? 'text-green-700 bg-green-100' : 'text-gray-500 bg-gray-200'
                        }`}>
                          {hasFuture ? 'Now Enrolling' : 'Completed'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {sessions.map((session, idx) => renderSessionRow(session, globalStartIdx + idx))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fallback: dual-mode series with no series:1/2 grouping (e.g. summer SteamOji afternoon) */}
              {series1Sessions.length === 0 && series2Sessions.length === 0 && enrollableSessions.length > 0 && (() => {
                const allIds = enrollableSessions.map((s) => s.id);
                const allFutureIds = enrollableSessions
                  .filter((_, idx) => !isPastByGlobalIdx(idx))
                  .map((s) => s.id);
                const allOn = allFutureIds.length > 0 && allFutureIds.every((id) => selectedWorkshopIds?.includes(id));
                const toggleAll = () => {
                  const current = selectedWorkshopIds || [];
                  const next = allOn
                    ? current.filter((id) => !allIds.includes(id))
                    : Array.from(new Set([...current, ...allFutureIds]));
                  setValue('selectedWorkshopIds', next, { shouldValidate: true });
                };
                const programName = sessionTypeKey === 'afternoon'
                  ? partner.afternoonProgram?.name
                  : partner.morningProgram?.name;
                return (
                  <div className="bg-indigo-50/60 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <label className={`flex items-start gap-3 ${allFutureIds.length === 0 ? 'opacity-60' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={allOn}
                          disabled={allFutureIds.length === 0}
                          onChange={toggleAll}
                          className="sr-only peer"
                          aria-label="Toggle full series enrollment"
                        />
                        <div className={`flex-shrink-0 w-5 h-5 mt-1 rounded border-2 flex items-center justify-center transition-colors ${
                          allFutureIds.length === 0
                            ? 'border-gray-300 bg-gray-100'
                            : allOn
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 bg-white'
                        }`}>
                          {allOn && allFutureIds.length > 0 && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">
                            {programName || 'Full Series Enrollment'}
                          </h4>
                          <p className="text-sm text-gray-600 mt-0.5">
                            {enrollableSessions.length} guided sessions
                            {allFutureIds.length > 0 && allFutureIds.length < enrollableSessions.length && (
                              <span className="ml-1.5 text-indigo-700">
                                · {allFutureIds.length} upcoming
                              </span>
                            )}
                          </p>
                        </div>
                      </label>
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                        Now Enrolling
                      </span>
                    </div>
                    <div className="space-y-2">
                      {enrollableSessions.map((session, idx) => {
                        const isPast = isPastByGlobalIdx(idx);
                        const dateText = sessionDates?.[idx]?.formatted || session.dateLabel;
                        const slot =
                          sessionTypeKey === 'afternoon'
                            ? session.afternoon
                            : session.morning;
                        const rowTitle = slot?.title || session.theme;
                        return (
                          <div
                            key={session.id}
                            className={`flex items-start gap-3 p-3 rounded-lg ${
                              isPast ? 'bg-gray-50/60 opacity-60' : 'bg-white/70'
                            }`}
                          >
                            <div
                              className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                                isPast
                                  ? 'bg-gray-200 text-gray-400'
                                  : 'bg-indigo-100 text-indigo-700'
                              }`}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-medium ${
                                    isPast ? 'text-gray-400 line-through' : 'text-gray-900'
                                  }`}
                                >
                                  {rowTitle}
                                </span>
                                <span
                                  className={`text-xs font-medium ${
                                    isPast ? 'text-gray-400 line-through' : 'text-gray-600'
                                  }`}
                                >
                                  {dateText}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Combined cost block — future-only sessions */}
              <div className="mt-4 bg-amber-50/50 rounded-xl p-5">
                {futureCount === 0 ? (
                  <div className="text-sm text-gray-700">
                    No upcoming sessions for this location. Check back when the next series is announced.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        {numberOfChildren > 1
                          ? `${numberOfChildren} children × ${futureCount} upcoming sessions × ${formatWorkshopPrice(pricePerSession)}`
                          : `${futureCount} upcoming sessions × ${formatWorkshopPrice(pricePerSession)}`}
                      </span>
                      <span className="text-sm text-gray-700">
                        {formatWorkshopPrice(totalPrice)}
                      </span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500">
                          Sales tax ({(taxRate * 100).toFixed(1)}%)
                        </span>
                        <span className="text-sm text-gray-600">
                          {formatWorkshopPrice(taxAmount)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center pt-1.5 border-t border-amber-200/40">
                      <span className="text-sm font-semibold text-gray-800">Total</span>
                      <span className="text-lg font-bold text-gray-900">
                        {formatWorkshopPrice(totalWithTax)}
                      </span>
                    </div>
                    {storybooksCompleted > 0 && (
                      <p className="text-xs text-gray-500">
                        Includes {storybooksCompleted} physical storybook{storybooksCompleted === 1 ? '' : 's'} your child creates during the upcoming sessions
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* --- INDIVIDUAL MODE: Select Workshop Dates --- */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              2. Select Workshop Dates
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-sm text-green-600 hover:text-green-700 font-medium"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-gray-600 font-medium"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {partner.sessions.map((session, index) => {
              const isSelected = selectedWorkshopIds?.includes(session.id);
              const spotsLeft = getSpotsLeft(session.id);
              const isSoldOut = spotsLeft !== null && spotsLeft <= 0;
              const isLowStock =
                spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 3;
              const isPast = isSessionPast(session.dateLabel);
              const isDisabled = isPast || isSoldOut;

              return (
                <label
                  key={session.id}
                  className={`block p-4 border-2 rounded-xl transition-all ${
                    isDisabled
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                      : isSelected
                        ? 'border-green-500 bg-green-50 cursor-pointer'
                        : 'border-gray-200 hover:border-gray-300 cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => !isDisabled && toggleWorkshop(session.id)}
                    disabled={isDisabled}
                    className="sr-only"
                  />
                  {/* Row 1: Checkbox + Week # + Theme + Price */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isDisabled
                            ? 'bg-gray-200 border-gray-300'
                            : isSelected
                              ? 'bg-green-600 border-green-600'
                              : 'border-gray-300 bg-white'
                        }`}
                      >
                        {isSelected && !isDisabled && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={3}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`font-semibold ${isPast ? 'line-through text-gray-400' : 'text-gray-900'}`}
                      >
                        Week {index + 1}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          isPast
                            ? 'text-gray-400 bg-gray-100 line-through'
                            : 'text-amber-700 bg-amber-50'
                        }`}
                      >
                        {session.theme}
                      </span>
                      {isPast && (
                        <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                          Completed
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      {!isPast && hasDiscount && (
                        <span className="line-through text-gray-400 mr-1">
                          {formatWorkshopPrice(originalPricePerSession)}
                        </span>
                      )}
                      <span
                        className={`font-semibold ${isPast ? 'line-through text-gray-400' : 'text-gray-900'}`}
                      >
                        {formatWorkshopPrice(pricePerSession)}
                      </span>
                    </div>
                  </div>
                  {/* Row 2: Date + Time + Status */}
                  <div className="flex items-center justify-between mt-1.5 ml-8">
                    <span
                      className={`text-sm ${isPast ? 'line-through text-gray-400' : 'text-gray-500'}`}
                    >
                      {session.dateLabel} · {sessionTimeLabel}
                    </span>
                    <div className="text-sm">
                      {isPast ? null : spotsLeft !== null ? (
                        isSoldOut ? (
                          <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            Sold out
                          </span>
                        ) : isLowStock ? (
                          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            {spotsLeft} spots left
                          </span>
                        )
                      ) : availabilityLoading ? (
                        <span className="text-xs text-gray-400 animate-pulse">
                          checking...
                        </span>
                      ) : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {errors.selectedWorkshopIds && (
            <p className={errorClassName} role="alert">
              {errors.selectedWorkshopIds.message}
            </p>
          )}

          {/* Price Summary (individual mode) */}
          {workshopCount > 0 && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">
                  {numberOfChildren > 1
                    ? `${numberOfChildren} children × ${workshopCount} session${workshopCount !== 1 ? 's' : ''}`
                    : `${workshopCount} session${workshopCount !== 1 ? 's' : ''} selected`}
                </span>
                <div className="text-right">
                  {hasDiscount && (
                    <span className="text-sm text-gray-400 line-through mr-2">
                      {formatWorkshopPrice(totalOriginal)}
                    </span>
                  )}
                  <span className="text-lg font-bold text-gray-900">
                    {formatWorkshopPrice(totalPrice)}
                  </span>
                </div>
              </div>
              {hasDiscount && (
                <p className="text-sm text-green-600 mt-1">
                  Promotional pricing applied — you save{' '}
                  {formatWorkshopPrice(totalOriginal - totalPrice)}!
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section 3: Parent / Guardian Information */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          {hasTimeSlots ? '4' : '3'}. Parent / Guardian Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="parentFirstName" className={labelClassName}>
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="parentFirstName"
              type="text"
              {...register('parentFirstName')}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.parentFirstName}
            />
            {errors.parentFirstName && (
              <p className={errorClassName} role="alert">
                {errors.parentFirstName.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="parentLastName" className={labelClassName}>
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              id="parentLastName"
              type="text"
              {...register('parentLastName')}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.parentLastName}
            />
            {errors.parentLastName && (
              <p className={errorClassName} role="alert">
                {errors.parentLastName.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="parentEmail" className={labelClassName}>
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="parentEmail"
              type="email"
              {...register('parentEmail')}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.parentEmail}
            />
            {errors.parentEmail && (
              <p className={errorClassName} role="alert">
                {errors.parentEmail.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="parentPhone" className={labelClassName}>
              Phone <span className="text-red-500">*</span>
            </label>
            <input
              id="parentPhone"
              type="tel"
              {...register('parentPhone')}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.parentPhone}
            />
            {errors.parentPhone && (
              <p className={errorClassName} role="alert">
                {errors.parentPhone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section 4: Child Information */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          {hasTimeSlots ? '5' : '4'}. Child Information
        </h3>
        <div className="space-y-4">
          {childrenFields.map((field, index) => (
            <div
              key={field.id}
              className={`${childrenFields.length > 1 ? 'p-4 bg-gray-50 rounded-xl border border-gray-200' : ''}`}
            >
              {childrenFields.length > 1 && (
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Child {index + 1}
                  </span>
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => removeChild(index)}
                      className="text-sm text-red-500 hover:text-red-600 font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor={`children.${index}.firstName`}
                    className={labelClassName}
                  >
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id={`children.${index}.firstName`}
                    type="text"
                    {...register(`children.${index}.firstName`)}
                    className={inputClassName}
                    aria-required="true"
                    aria-invalid={!!errors.children?.[index]?.firstName}
                  />
                  {errors.children?.[index]?.firstName && (
                    <p className={errorClassName} role="alert">
                      {errors.children[index].firstName?.message}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor={`children.${index}.lastName`}
                    className={labelClassName}
                  >
                    Last Name
                  </label>
                  <input
                    id={`children.${index}.lastName`}
                    type="text"
                    {...register(`children.${index}.lastName`)}
                    className={inputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor={`children.${index}.age`}
                    className={labelClassName}
                  >
                    Age <span className="text-red-500">*</span>
                  </label>
                  <select
                    id={`children.${index}.age`}
                    {...register(`children.${index}.age`, {
                      valueAsNumber: true,
                    })}
                    className={inputClassName}
                    aria-required="true"
                    aria-invalid={!!errors.children?.[index]?.age}
                  >
                    <option value="">Select age</option>
                    {Array.from({ length: 12 }, (_, i) => i + 3).map((age) => (
                      <option key={age} value={age}>
                        {age} years old
                      </option>
                    ))}
                  </select>
                  {errors.children?.[index]?.age && (
                    <p className={errorClassName} role="alert">
                      {errors.children[index].age?.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {errors.children?.message && (
            <p className={errorClassName} role="alert">
              {errors.children.message}
            </p>
          )}
          {childrenFields.length < 3 && (
            <button
              type="button"
              onClick={() =>
                addChild({
                  firstName: '',
                  lastName: '',
                  age: undefined as unknown as number,
                })
              }
              className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Another Child
            </button>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section 5: Emergency Contact (non-school partners only) */}
      {/* ═══════════════════════════════════════════════════════ */}
      {!isSingleMode && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {hasTimeSlots ? '6' : '5'}. Emergency Contact
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="emergencyContactName" className={labelClassName}>
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="emergencyContactName"
                type="text"
                {...register('emergencyContactName')}
                className={inputClassName}
                aria-required="true"
                aria-invalid={!!errors.emergencyContactName}
              />
              {errors.emergencyContactName && (
                <p className={errorClassName} role="alert">
                  {errors.emergencyContactName.message}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="emergencyContactPhone" className={labelClassName}>
                Phone <span className="text-red-500">*</span>
              </label>
              <input
                id="emergencyContactPhone"
                type="tel"
                {...register('emergencyContactPhone')}
                className={inputClassName}
                aria-required="true"
                aria-invalid={!!errors.emergencyContactPhone}
              />
              {errors.emergencyContactPhone && (
                <p className={errorClassName} role="alert">
                  {errors.emergencyContactPhone.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="emergencyContactRelation"
                className={labelClassName}
              >
                Relationship <span className="text-red-500">*</span>
              </label>
              <input
                id="emergencyContactRelation"
                type="text"
                placeholder="e.g. Grandparent, Aunt"
                {...register('emergencyContactRelation')}
                className={inputClassName}
                aria-required="true"
                aria-invalid={!!errors.emergencyContactRelation}
              />
              {errors.emergencyContactRelation && (
                <p className={errorClassName} role="alert">
                  {errors.emergencyContactRelation.message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Section 5/6: Digital Waiver */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          {hasTimeSlots ? '6' : isSingleMode ? '5' : '6'}. Digital Waiver
        </h3>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('waiverAccepted')}
              className="sr-only peer"
            />
            <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-green-600 peer-checked:border-green-600 flex items-center justify-center transition-colors">
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-sm text-gray-700">
              I, as the parent/guardian, agree to the{' '}
              <button
                type="button"
                onClick={() => setShowWaiverText(!showWaiverText)}
                className="text-green-600 hover:text-green-700 font-medium underline"
              >
                workshop participation waiver
              </button>
              . I understand that my child will participate in creative and
              hands-on activities, and I consent to the activity participation,
              emergency procedures, and safety guidelines outlined in the
              waiver.{' '}
              <span className="text-red-500">*</span>
            </span>
          </label>
          {errors.waiverAccepted && (
            <p className={`${errorClassName} ml-8`} role="alert">
              {errors.waiverAccepted.message}
            </p>
          )}

          {showWaiverText && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-sm text-gray-600 max-h-60 overflow-y-auto">
              <h4 className="font-semibold text-gray-900 mb-2">
                Workshop Participation Waiver
              </h4>
              <p className="mb-2">
                By registering my child for KindleWood Learning Lab workshops, I
                acknowledge and agree to the following:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Activity Participation:</strong> My child will engage
                  in creative, hands-on activities including art, storytelling,
                  and maker projects. I understand these activities are
                  age-appropriate and supervised.
                </li>
                <li>
                  <strong>Emergency Authorization:</strong> In case of emergency,
                  I authorize workshop staff to seek appropriate medical
                  attention for my child.{' '}
                  {isSingleMode
                    ? 'I understand that emergency contacts on file with the school will be used.'
                    : 'I have provided accurate emergency contact information.'}
                </li>
                <li>
                  <strong>Assumption of Risk:</strong> I understand that while
                  all reasonable safety precautions are taken, participation in
                  creative and physical activities carries inherent risks. I
                  assume responsibility for any injury or loss.
                </li>
                <li>
                  <strong>Allergies/Medical Conditions:</strong> I will inform
                  workshop staff of any allergies, medical conditions, or special
                  needs my child may have prior to the first session.
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Code of Conduct — all SteamOji programs (spring, summer, future) require it */}
        {partner.id.startsWith('steamoji') && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                {...register('codeOfConductAccepted')}
                className="sr-only peer"
              />
              <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-green-600 peer-checked:border-green-600 flex items-center justify-center transition-colors">
                <svg
                  className="w-3 h-3 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <span className="text-sm text-gray-700">
                I have read and agree to follow the{' '}
                <a
                  href="https://docs.google.com/document/d/1ADh0zqwZEogHO1uxJo7aAcSS0dyhTmzf3MjGbr4qhSc/edit?tab=t.0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 hover:text-green-700 font-medium underline"
                >
                  SteamOji Code of Conduct
                </a>
                .{' '}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.codeOfConductAccepted && (
              <p className={`${errorClassName} ml-8`} role="alert">
                {errors.codeOfConductAccepted.message}
              </p>
            )}
          </div>
        )}

        {/* Photo/Video Consent — all partners (optional, awareness only) */}
        <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('photoVideoConsentAccepted')}
              className="sr-only peer"
            />
            <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-green-600 peer-checked:border-green-600 flex items-center justify-center transition-colors">
              <svg
                className="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <span className="text-sm text-gray-700">
              <strong>Photo/Video Consent (Optional):</strong> I grant permission for
              workshop facilitators to photograph or video-record my
              child&apos;s artwork and creative process during workshop
              activities for educational documentation and promotional
              purposes. No photographs of children&apos;s faces will be
              taken or shared.
            </span>
          </label>
        </div>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
        >
          {submitError}
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={isSubmitting || workshopCount === 0}
          className="w-full py-4 px-8 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-lg transition-all shadow-md hover:shadow-lg"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processing...
            </span>
          ) : workshopCount === 0 ? (
            'Select sessions to continue'
          ) : (
            `Proceed to Payment — ${formatWorkshopPrice(totalWithTax)}`
          )}
        </button>
        <p className="text-center text-sm text-gray-500 mt-2">
          You&apos;ll be redirected to Stripe for secure payment. Promo codes
          can be applied at checkout.
        </p>
      </div>
    </form>
  );
}
