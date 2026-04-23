/**
 * Client-only provider that initializes PostHog on mount and keeps the
 * distinct_id in sync with Supabase auth state: identify on sign-in, reset
 * on sign-out. No-op if NEXT_PUBLIC_POSTHOG_KEY is missing.
 */

'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { identify, initPostHog, reset } from '@/lib/telemetry/posthog';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();

    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session?.user?.id) identify(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        reset();
      } else if (session?.user?.id) {
        identify(session.user.id);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
