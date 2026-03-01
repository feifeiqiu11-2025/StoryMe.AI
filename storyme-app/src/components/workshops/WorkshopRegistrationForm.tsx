/**
 * WorkshopRegistrationForm Component
 *
 * Multi-step registration form for workshop sign-ups.
 * Uses React Hook Form + Zod for validation, Stripe for payment.
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  WorkshopRegistrationSchema,
  type WorkshopRegistrationData,
} from '@/lib/workshops/schemas';
import {
  type WorkshopPartner,
  formatWorkshopPrice,
} from '@/lib/workshops/constants';

interface WorkshopRegistrationFormProps {
  partner: WorkshopPartner;
  defaultSessionType?: 'morning' | 'afternoon';
}

export default function WorkshopRegistrationForm({
  partner,
  defaultSessionType,
}: WorkshopRegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showWaiverText, setShowWaiverText] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<WorkshopRegistrationData>({
    resolver: zodResolver(WorkshopRegistrationSchema) as any,
    defaultValues: {
      partnerId: partner.id,
      selectedWorkshopIds: [],
      selectedSessionType: defaultSessionType || undefined,
      parentFirstName: '',
      parentLastName: '',
      parentEmail: '',
      parentPhone: '',
      childFirstName: '',
      childLastName: '',
      childAge: undefined as unknown as number,
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      waiverAccepted: undefined as unknown as true,
    },
  });

  const selectedWorkshopIds = watch('selectedWorkshopIds');
  const selectedSessionType = watch('selectedSessionType');

  // Per-session pricing
  const sessionType = selectedSessionType || 'morning';
  const sessionPricing = partner.pricing[sessionType];
  const pricePerSession = sessionPricing?.promoPrice || 0;
  const originalPricePerSession = sessionPricing?.originalPrice || 0;
  const hasDiscount = pricePerSession > 0 && pricePerSession < originalPricePerSession;

  const workshopCount = selectedWorkshopIds?.length || 0;
  const totalPrice = workshopCount * pricePerSession;
  const totalOriginal = workshopCount * originalPricePerSession;

  // --- Bundle pricing (commented out for future use) ---
  // const isBundle = workshopCount >= partner.pricing.bundleCount;
  // const totalPrice = isBundle
  //   ? partner.pricing.bundlePrice
  //   : workshopCount * partner.pricing.singleWorkshop;
  // const fullPrice = workshopCount * partner.pricing.singleWorkshop;
  // const savings = isBundle ? fullPrice - partner.pricing.bundlePrice : 0;
  // const savingsPercent = getBundleSavingsPercent(partner.pricing);

  // Toggle workshop selection
  const toggleWorkshop = (workshopId: string) => {
    const current = selectedWorkshopIds || [];
    const updated = current.includes(workshopId)
      ? current.filter((id) => id !== workshopId)
      : [...current, workshopId];
    setValue('selectedWorkshopIds', updated, { shouldValidate: true });
  };

  // Select all workshops
  const selectAll = () => {
    const allIds = partner.sessions.map((s) => s.id);
    setValue('selectedWorkshopIds', allIds, { shouldValidate: true });
  };

  // Clear all selections
  const clearAll = () => {
    setValue('selectedWorkshopIds', [], { shouldValidate: true });
  };

  const onSubmit = async (data: WorkshopRegistrationData): Promise<void> => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/workshop-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe checkout
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

  const sessionTimeLabel = sessionType === 'morning'
    ? '10:00 – 11:00 AM (1 hr)'
    : '1:00 – 3:00 PM (2 hrs)';

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Hidden partner ID */}
      <input type="hidden" {...register('partnerId')} />

      {/* Section 1: Session Type */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          1. Choose Your Session
        </h3>
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
            <span className="text-sm text-gray-500 mt-1">Ages 4–6 · 10:00 – 11:00 AM · 1 hour</span>
            <div className="mt-2">
              {hasDiscount && selectedSessionType === 'morning' ? (
                <span className="text-sm">
                  <span className="line-through text-gray-400 mr-1">{formatWorkshopPrice(partner.pricing.morning.originalPrice)}</span>
                  <span className="font-bold text-amber-700">{formatWorkshopPrice(partner.pricing.morning.promoPrice)}</span>
                  <span className="text-gray-500"> / session</span>
                </span>
              ) : (
                <span className="text-sm">
                  <span className="line-through text-gray-400 mr-1">{formatWorkshopPrice(partner.pricing.morning.originalPrice)}</span>
                  <span className="font-semibold text-gray-700">{formatWorkshopPrice(partner.pricing.morning.promoPrice)}</span>
                  <span className="text-gray-500"> / session</span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Turn imagination into story characters, make physical books, show & tell
            </p>
          </label>

          <label
            className={`relative flex flex-col p-4 border-2 rounded-xl cursor-pointer transition-all ${
              selectedSessionType === 'afternoon'
                ? 'border-green-500 bg-green-50'
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
            <span className="text-sm text-gray-500 mt-1">Ages 7–9 · 1:00 – 3:00 PM · 2 hours</span>
            <div className="mt-2">
              {hasDiscount && selectedSessionType === 'afternoon' ? (
                <span className="text-sm">
                  <span className="line-through text-gray-400 mr-1">{formatWorkshopPrice(partner.pricing.afternoon.originalPrice)}</span>
                  <span className="font-bold text-green-700">{formatWorkshopPrice(partner.pricing.afternoon.promoPrice)}</span>
                  <span className="text-gray-500"> / session</span>
                </span>
              ) : (
                <span className="text-sm">
                  <span className="line-through text-gray-400 mr-1">{formatWorkshopPrice(partner.pricing.afternoon.originalPrice)}</span>
                  <span className="font-semibold text-gray-700">{formatWorkshopPrice(partner.pricing.afternoon.promoPrice)}</span>
                  <span className="text-gray-500"> / session</span>
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Nature exploration, creative thinking & story making
            </p>
          </label>
        </div>
        {errors.selectedSessionType && (
          <p className={errorClassName} role="alert">
            {errors.selectedSessionType.message}
          </p>
        )}
      </div>

      {/* Section 2: Select Workshop Dates */}
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

        <div className="space-y-2">
          {partner.sessions.map((session, index) => {
            const isSelected = selectedWorkshopIds?.includes(session.id);
            return (
              <label
                key={session.id}
                className={`flex items-center justify-between p-4 border-2 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-300 bg-white'
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleWorkshop(session.id)}
                    className="sr-only"
                  />
                  <div>
                    <span className="font-medium text-gray-900">
                      Week {index + 1}
                    </span>
                    <span className="text-gray-500 ml-2 text-sm">
                      {session.dateLabel}
                    </span>
                    <span className="ml-2 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      {session.theme}
                    </span>
                  </div>
                </div>
                <div className="text-sm text-right">
                  {hasDiscount && (
                    <span className="line-through text-gray-400 mr-1">
                      {formatWorkshopPrice(originalPricePerSession)}
                    </span>
                  )}
                  <span className="font-semibold text-gray-900">
                    {formatWorkshopPrice(pricePerSession)}
                  </span>
                  <span className="text-gray-400 ml-1 hidden sm:inline">
                    · {sessionTimeLabel}
                  </span>
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

        {/* Price Summary */}
        {workshopCount > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">
                {workshopCount} session{workshopCount !== 1 ? 's' : ''} selected
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
                Promotional pricing applied — you save {formatWorkshopPrice(totalOriginal - totalPrice)}!
              </p>
            )}

            {/* --- Bundle upsell (commented out for future use) ---
            {!isBundle && workshopCount > 0 && workshopCount < partner.pricing.bundleCount && (
              <p className="text-sm text-gray-500 mt-2">
                Select all {partner.pricing.bundleCount} workshops for{' '}
                {savingsPercent}% off!
              </p>
            )} */}
          </div>
        )}
      </div>

      {/* Promo code section — now handled by Stripe's allow_promotion_codes at checkout
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          3. Promo Code <span className="text-sm font-normal text-gray-400">(optional)</span>
        </h3>
        <input
          type="text"
          {...register('promoCode')}
          placeholder="Enter promo code"
          className={inputClassName}
        />
        <p className="text-sm text-gray-500 mt-1">
          If you have a promo code, enter it here. It will be applied at
          checkout for additional savings.
        </p>
      </div> */}

      {/* Section 3: Parent / Guardian Info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          3. Parent / Guardian Information
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

      {/* Section 4: Child Info */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          4. Child Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label htmlFor="childFirstName" className={labelClassName}>
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              id="childFirstName"
              type="text"
              {...register('childFirstName')}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.childFirstName}
            />
            {errors.childFirstName && (
              <p className={errorClassName} role="alert">
                {errors.childFirstName.message}
              </p>
            )}
          </div>
          <div>
            <label htmlFor="childLastName" className={labelClassName}>
              Last Name
            </label>
            <input
              id="childLastName"
              type="text"
              {...register('childLastName')}
              className={inputClassName}
            />
          </div>
          <div>
            <label htmlFor="childAge" className={labelClassName}>
              Age <span className="text-red-500">*</span>
            </label>
            <select
              id="childAge"
              {...register('childAge', { valueAsNumber: true })}
              className={inputClassName}
              aria-required="true"
              aria-invalid={!!errors.childAge}
            >
              <option value="">Select age</option>
              {Array.from({ length: 12 }, (_, i) => i + 3).map((age) => (
                <option key={age} value={age}>
                  {age} years old
                </option>
              ))}
            </select>
            {errors.childAge && (
              <p className={errorClassName} role="alert">
                {errors.childAge.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 5: Emergency Contact */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          5. Emergency Contact
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
            <label htmlFor="emergencyContactRelation" className={labelClassName}>
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

      {/* Section 6: Digital Waiver */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">
          6. Digital Waiver
        </h3>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              {...register('waiverAccepted')}
              className="sr-only peer"
            />
            <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 border-gray-300 bg-white peer-checked:bg-green-600 peer-checked:border-green-600 flex items-center justify-center transition-colors">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
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
              hands-on activities, and I consent to activity participation,
              photo/video documentation for educational purposes, and the
              emergency procedures outlined in the waiver.{' '}
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
                  nature exploration, and maker projects. I understand these
                  activities are age-appropriate and supervised.
                </li>
                <li>
                  <strong>Photo/Video Consent:</strong> I grant permission for
                  workshop facilitators to photograph or video-record my child
                  during workshop activities for educational documentation and
                  promotional purposes. I may opt out by notifying staff.
                </li>
                <li>
                  <strong>Emergency Authorization:</strong> In case of emergency,
                  I authorize workshop staff to seek appropriate medical
                  attention for my child. I have provided accurate emergency
                  contact information.
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
                <li>
                  <strong>Drop-off/Pick-up:</strong> I am responsible for
                  ensuring my child is dropped off and picked up on time. Children
                  must be signed in and out by an authorized adult.
                </li>
              </ul>
            </div>
          )}
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
            `Proceed to Payment — ${formatWorkshopPrice(totalPrice)}`
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
