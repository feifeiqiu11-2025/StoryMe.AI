'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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

const INTEREST_OPTIONS: { value: CreateLeadInput['interest']; label: string }[] = [
  { value: 'job', label: 'Joining the team' },
  { value: 'school_partnership', label: 'School or Educator Partnership' },
  { value: 'product_interest', label: 'Learning more about KindleWood' },
];

const SOURCE_SLUG_RE = /^[a-z0-9][a-z0-9\-_]*$/;

function readSource(raw: string | null): string {
  if (!raw) return 'footer';
  const trimmed = raw.trim().toLowerCase().slice(0, 100);
  return SOURCE_SLUG_RE.test(trimmed) ? trimmed : 'footer';
}

function readInterest(raw: string | null): CreateLeadInput['interest'] {
  const parsed = LeadInterestSchema.safeParse(raw);
  return parsed.success ? parsed.data : 'product_interest';
}

function readMedium(raw: string | null): CreateLeadInput['source_medium'] | undefined {
  const parsed = LeadSourceMediumSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export default function ContactPage() {
  return (
    <Suspense fallback={<ContactPageShell />}>
      <ContactPageInner />
    </Suspense>
  );
}

function ContactPageShell() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-20" />
    </div>
  );
}

function ContactPageInner() {
  const params = useSearchParams();
  const source = useMemo(() => readSource(params.get('source')), [params]);
  const initialInterest = useMemo(() => readInterest(params.get('interest')), [params]);
  const sourceMedium = useMemo(() => readMedium(params.get('medium')), [params]);

  const [interest, setInterest] = useState<CreateLeadInput['interest']>(initialInterest);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setInterest(initialInterest);
  }, [initialInterest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setErrorMessage(null);

    const payload = {
      email,
      name: name || undefined,
      interest,
      message: message || undefined,
      consent_marketing: consent,
      source,
      source_medium: sourceMedium,
      auth_provider: 'email' as const,
    };

    const parsed = CreateLeadRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(firstIssue?.message ?? 'Please check your entries.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? 'Submission failed');
      }
      setSubmittedAt(Date.now());
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setOauthLoading(provider);
    setErrorMessage(null);

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(
        PENDING_LEAD_SESSION_KEY,
        JSON.stringify({
          interest,
          message: message || undefined,
          consent_marketing: consent,
          source,
          source_medium: sourceMedium,
          provider,
        })
      );
    }

    try {
      const supabase = createClient();
      const baseUrl = window.location.origin;
      const callbackUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent('/contact/thanks')}`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch (err) {
      setOauthLoading(null);
      setErrorMessage(err instanceof Error ? err.message : 'Sign-in failed. Please use the form below.');
    }
  }

  if (submittedAt) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <LandingNav />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-20">
          <ThankYou source={source} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-12 pb-20">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Let&apos;s stay in touch</h1>
          <p className="text-gray-700 leading-relaxed">
            Leave us your name and email — we&apos;ll reach out to keep the conversation going.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-8 space-y-6"
          aria-describedby={errorMessage ? 'contact-error' : undefined}
          noValidate
        >
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">I&apos;m interested in</legend>
            <div role="radiogroup" className="space-y-2">
              {INTEREST_OPTIONS.map((opt) => {
                const selected = interest === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 min-h-[48px] px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                      selected
                        ? 'border-amber-600 bg-amber-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="interest"
                      value={opt.value}
                      checked={selected}
                      onChange={() => setInterest(opt.value)}
                      className="w-4 h-4 text-amber-600 focus:ring-amber-600"
                    />
                    <span className="text-gray-900">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="contact-name" className="block text-sm font-semibold text-gray-900 mb-1.5">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoCapitalize="words"
                maxLength={100}
                placeholder="Your name"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-sm font-semibold text-gray-900 mb-1.5">
                Email <span className="text-red-600">*</span>
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                aria-required="true"
                maxLength={320}
                placeholder="you@example.com"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-message" className="block text-sm font-semibold text-gray-900 mb-1.5">
              Message <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="contact-message"
              name="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Anything you'd like us to know"
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 outline-none resize-y"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 text-amber-600 rounded focus:ring-amber-600"
            />
            <span className="text-sm text-gray-700">
              Send me occasional updates about KindleWood. You can unsubscribe anytime.
            </span>
          </label>

          {errorMessage && (
            <div
              id="contact-error"
              role="alert"
              aria-live="polite"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700"
            >
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </form>

        <div className="mt-8">
          <div className="relative flex items-center justify-center mb-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300" /></div>
            <span className="relative px-3 bg-transparent text-sm text-gray-500">or skip typing</span>
          </div>
          <div className="space-y-3">
            <OAuthButton
              provider="google"
              loading={oauthLoading === 'google'}
              disabled={oauthLoading !== null}
              onClick={() => handleOAuth('google')}
            />
            <OAuthButton
              provider="apple"
              loading={oauthLoading === 'apple'}
              disabled={oauthLoading !== null}
              onClick={() => handleOAuth('apple')}
            />
            <p className="text-xs text-gray-500 text-center px-4">
              We&apos;ll only use your name and email to follow up. We won&apos;t post anything or message your contacts.
            </p>
          </div>
        </div>

        <p className="text-center mt-10 text-sm text-gray-500">
          Prefer email? Write to{' '}
          <a href="mailto:admin@kindlewoodstudio.ai" className="text-amber-700 hover:text-amber-800 font-medium">
            admin@kindlewoodstudio.ai
          </a>
        </p>
      </main>
    </div>
  );
}

function OAuthButton({
  provider,
  loading,
  disabled,
  onClick,
}: {
  provider: 'google' | 'apple';
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = provider === 'google' ? 'Continue with Google' : 'Continue with Apple';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full flex items-center justify-center gap-3 min-h-[48px] px-4 py-3 border border-gray-300 rounded-xl bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <span className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" aria-hidden="true" />
      ) : provider === 'google' ? (
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
      ) : (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      )}
      <span className="font-medium text-gray-800">{label}</span>
    </button>
  );
}

function ThankYou({ source }: { source: string }) {
  return (
    <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10 text-center">
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
        {source !== 'footer' && (
          <span className="ml-3 text-gray-400">· Source: {source}</span>
        )}
      </p>
    </div>
  );
}
