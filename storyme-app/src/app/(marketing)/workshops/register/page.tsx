/**
 * Workshop Registration Page
 * /workshops/register?session=morning|afternoon
 *
 * Dedicated registration page with session-aware form,
 * promo banner, and success/cancelled handling.
 *
 * Extensible for future partners/events via query params:
 *   ?session=morning|afternoon
 *   ?partner=steamoji (future)
 *   ?event=summer-camp (future)
 */

'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import WorkshopRegistrationForm from '@/components/workshops/WorkshopRegistrationForm';
import { WORKSHOP_PARTNERS } from '@/lib/workshops/constants';
import type { WorkshopAvailabilityData } from '@/lib/workshops/types';

function RegistrationBanner() {
  const searchParams = useSearchParams();
  const registration = searchParams.get('registration');

  if (registration === 'success') {
    return (
      <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-center">
        <p className="font-semibold text-lg">Registration Confirmed!</p>
        <p className="text-sm mt-1">
          Thank you for registering! You&apos;ll receive a confirmation email
          shortly with workshop details.
        </p>
      </div>
    );
  }

  if (registration === 'cancelled') {
    return (
      <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-center">
        <p className="font-semibold">Registration Not Completed</p>
        <p className="text-sm mt-1">
          Your payment was cancelled. You can try again below whenever
          you&apos;re ready.
        </p>
      </div>
    );
  }

  return null;
}

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const sessionParam = searchParams.get('session');

  // Default to morning if invalid/missing session param
  const defaultSession: 'morning' | 'afternoon' =
    sessionParam === 'afternoon' ? 'afternoon' : 'morning';

  // Find the active partner (extensible: future ?partner= param)
  const activePartner = WORKSHOP_PARTNERS.find((p) => !p.comingSoon);

  // Fetch spot availability on page load
  const [availability, setAvailability] =
    useState<WorkshopAvailabilityData | null>(null);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);

  useEffect(() => {
    if (!activePartner) return;

    async function fetchAvailability() {
      try {
        const res = await fetch(
          `/api/v1/workshops/availability?partnerId=${activePartner!.id}`,
        );
        const json = await res.json();
        if (json.success && json.data) {
          setAvailability(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch availability:', error);
      } finally {
        setAvailabilityLoading(false);
      }
    }

    fetchAvailability();
  }, [activePartner]);

  if (!activePartner) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          No Active Workshops
        </h1>
        <p className="text-gray-600 mb-6">
          There are no workshops currently accepting registrations.
        </p>
        <Link
          href="/workshops"
          className="text-purple-600 hover:text-purple-700 font-medium"
        >
          ← Back to Workshops
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Registration Status Banner */}
      <RegistrationBanner />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/workshops"
          className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          ← Back to Workshops & Events
        </Link>
      </div>

      {/* Page Title */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Register for Workshops
        </h1>
        <p className="text-gray-600">
          Select your sessions and complete registration below.
        </p>
      </div>

      {/* Promo Banner */}
      <div className="mb-6 text-center">
        <p className="text-purple-800 font-medium">
          Register for any workshop and get 1 month free Casual Creator subscription!
        </p>
        <Link
          href="/pricing"
          className="text-sm text-purple-600 hover:text-purple-700 underline transition-colors"
        >
          Learn about our online products →
        </Link>
      </div>

      {/* Registration Form */}
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <WorkshopRegistrationForm
          partner={activePartner}
          defaultSessionType={defaultSession}
          availability={availability}
          availabilityLoading={availabilityLoading}
        />
      </div>
    </div>
  );
}

export default function WorkshopRegisterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <Suspense
        fallback={
          <div className="max-w-3xl mx-auto px-4 py-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/2 mx-auto" />
              <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
            </div>
          </div>
        }
      >
        <RegisterPageContent />
      </Suspense>

      {/* Footer */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-4 text-center py-8">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600 mb-4">
            <a
              href="mailto:Admin@KindleWoodStudio.ai"
              className="hover:text-indigo-600 transition-colors"
            >
              Contact
            </a>
            <Link
              href="/support"
              className="hover:text-indigo-600 transition-colors"
            >
              Support
            </Link>
            <Link
              href="/privacy"
              className="hover:text-indigo-600 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-indigo-600 transition-colors"
            >
              Terms
            </Link>
          </div>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KindleWood Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
