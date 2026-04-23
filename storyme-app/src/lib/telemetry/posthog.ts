/**
 * PostHog client singleton.
 *
 * Safe to import from any client component. No-op if NEXT_PUBLIC_POSTHOG_KEY
 * is missing or empty — so the app runs fine in dev/staging without PostHog.
 *
 * COPPA: event capture only, no session replay. Children (ages 7-9) use this
 * app; we do not record sessions even with masking. disable_session_recording
 * is set defensively in case replay is toggled on at the PostHog dashboard level.
 */

'use client';

import posthog from 'posthog-js';

let initialized = false;

export function initPostHog(): void {
  if (initialized) return;
  if (typeof window === 'undefined') return; // server safety

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    // No-op silently in dev / when not configured
    return;
  }

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    disable_session_recording: true,
    loaded: () => {
      initialized = true;
    },
  });
  initialized = true;
}

/** Returns the posthog instance if initialized, else a stub that no-ops. */
export function getPostHog() {
  if (!initialized) return null;
  return posthog;
}

/**
 * Fire an event. Safe to call even if PostHog isn't initialized.
 * Properties must be primitives only — no story content, no PII in values.
 */
export function capture(event: string, properties?: Record<string, string | number | boolean | null | undefined>): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.capture(event, properties);
  } catch (e) {
    // Never let telemetry crash the app
    console.warn('[telemetry] capture failed:', e);
  }
}

/** Associate current session with a user (call after auth). */
export function identify(userId: string): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.identify(userId);
  } catch (e) {
    console.warn('[telemetry] identify failed:', e);
  }
}

/** Clear user identity (call on logout). */
export function reset(): void {
  const ph = getPostHog();
  if (!ph) return;
  try {
    ph.reset();
  } catch (e) {
    console.warn('[telemetry] reset failed:', e);
  }
}
