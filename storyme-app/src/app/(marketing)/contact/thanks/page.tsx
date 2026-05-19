'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import LandingNav from '@/components/navigation/LandingNav';
import { createClient } from '@/lib/supabase/client';
import {
  CreateLeadRequestSchema,
  type CreateLeadInput,
  LeadInterestSchema,
  LeadSourceMediumSchema,
} from '@/lib/leads/schemas';

const PENDING_LEAD_SESSION_KEY = 'kw_pending_lead';

type PendingLead = {
  interest: CreateLeadInput['interest'];
  message?: string;
  consent_marketing: boolean;
  source: string;
  source_medium?: CreateLeadInput['source_medium'];
  provider: 'google' | 'apple';
};

function readPendingLead(): PendingLead | null {
  if (typeof window === 'undefined') return null;
  const raw = sessionStorage.getItem(PENDING_LEAD_SESSION_KEY);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as PendingLead;
    if (!LeadInterestSchema.safeParse(obj.interest).success) return null;
    if (obj.source_medium && !LeadSourceMediumSchema.safeParse(obj.source_medium).success) {
      delete obj.source_medium;
    }
    if (typeof obj.source !== 'string' || !obj.source) return null;
    if (obj.provider !== 'google' && obj.provider !== 'apple') return null;
    return obj;
  } catch {
    return null;
  }
}

export default function ContactThanksPage() {
  const [state, setState] = useState<'finalizing' | 'done' | 'error'>('finalizing');
  const finalized = useRef(false);

  useEffect(() => {
    if (finalized.current) return;
    finalized.current = true;

    (async () => {
      const pending = readPendingLead();

      if (!pending) {
        setState('done');
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.email) {
          setState('done');
          return;
        }

        const name =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          undefined;

        const payload = {
          email: user.email,
          name,
          interest: pending.interest,
          message: pending.message,
          consent_marketing: pending.consent_marketing,
          source: pending.source,
          source_medium: pending.source_medium,
          auth_provider: pending.provider,
          user_id: user.id,
        };

        const parsed = CreateLeadRequestSchema.safeParse(payload);
        if (!parsed.success) {
          setState('done');
          return;
        }

        const res = await fetch('/api/v1/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });

        sessionStorage.removeItem(PENDING_LEAD_SESSION_KEY);

        if (!res.ok) {
          setState('error');
          return;
        }
        setState('done');
      } catch {
        setState('error');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20">
        <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10 text-center">
          {state === 'finalizing' ? (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Saving your info...</h1>
              <div
                className="inline-block w-8 h-8 border-2 border-gray-300 border-t-amber-700 rounded-full animate-spin"
                aria-label="Saving"
              />
            </>
          ) : state === 'error' ? (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Something went wrong</h1>
              <p className="text-gray-700 leading-relaxed mb-6">
                We couldn&apos;t save your info. Please try again or email us directly at{' '}
                <a href="mailto:admin@kindlewoodstudio.ai" className="text-amber-700 hover:text-amber-800 font-medium">
                  admin@kindlewoodstudio.ai
                </a>
                .
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold transition-colors"
              >
                Try again
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Thank you!</h1>
              <p className="text-gray-700 leading-relaxed mb-6">
                We&apos;ll be in touch soon. In the meantime, save us to your contacts so you remember where the email came from.
              </p>
              <a
                href="/contact/kindlewood.vcf"
                download
                className="inline-flex items-center justify-center min-h-[48px] px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold transition-colors"
              >
                Save KindleWood to contacts
              </a>
              <p className="mt-6 text-sm text-gray-500">
                <Link href="/" className="text-amber-700 hover:text-amber-800 font-medium">
                  Back to home
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
