/**
 * Client-only provider that initializes PostHog on mount.
 * No-op if NEXT_PUBLIC_POSTHOG_KEY is missing.
 */

'use client';

import { useEffect } from 'react';
import { initPostHog } from '@/lib/telemetry/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);
  return <>{children}</>;
}
