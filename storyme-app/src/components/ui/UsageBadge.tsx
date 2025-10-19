/**
 * UsageBadge Component
 * Displays user's image generation usage with trial/premium status
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface UsageData {
  count: number;
  limit: number;
  tier: string;
  trialEndsAt: string | null;
}

export default function UsageBadge() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('images_generated_count, images_limit, subscription_tier, trial_ends_at')
            .eq('id', user.id)
            .single();

          if (data && !error) {
            setUsage({
              count: data.images_generated_count || 0,
              limit: data.images_limit || 50,
              tier: data.subscription_tier || 'free',
              trialEndsAt: data.trial_ends_at
            });
          }
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();

    // Refresh usage every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !usage) {
    return null;
  }

  // Premium users
  if (usage.tier === 'premium') {
    return (
      <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-semibold shadow-md">
        ✨ Premium - Unlimited
      </div>
    );
  }

  // Trial users
  const percentage = (usage.count / usage.limit) * 100;
  const remaining = usage.limit - usage.count;
  const isLow = percentage >= 80;
  const isCritical = percentage >= 90;

  // Calculate days remaining in trial
  let daysRemaining = null;
  if (usage.trialEndsAt) {
    const endDate = new Date(usage.trialEndsAt);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="flex items-center gap-2">
      {/* Usage Badge */}
      <div
        className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${
          isCritical
            ? 'bg-red-100 text-red-700'
            : isLow
            ? 'bg-orange-100 text-orange-700'
            : 'bg-blue-100 text-blue-700'
        }`}
      >
        <span className="flex items-center gap-1.5">
          📊 {remaining}/{usage.limit} images left
        </span>
      </div>

      {/* Trial Timer (if applicable) */}
      {daysRemaining !== null && daysRemaining <= 3 && (
        <div className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
          ⏰ {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
        </div>
      )}

      {/* Upgrade CTA for low usage */}
      {(isLow || (daysRemaining !== null && daysRemaining <= 3)) && (
        <Link
          href="/upgrade"
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full text-sm font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md"
        >
          ⬆️ Upgrade
        </Link>
      )}
    </div>
  );
}
