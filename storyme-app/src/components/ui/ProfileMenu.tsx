/**
 * ProfileMenu Component
 * Dropdown menu showing user profile, usage stats, and upgrade options
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface UsageData {
  count: number;
  limit: number;
  tier: string;
  trialEndsAt: string | null;
  trialStatus: string | null;
}

interface ProfileMenuProps {
  displayName: string;
}

export default function ProfileMenu({ displayName }: ProfileMenuProps) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data, error } = await supabase
            .from('users')
            .select('images_generated_count, images_limit, subscription_tier, trial_ends_at, trial_status')
            .eq('id', user.id)
            .single();

          if (data && !error) {
            setUsage({
              count: data.images_generated_count || 0,
              limit: data.images_limit || 50,
              tier: data.subscription_tier || 'free',
              trialEndsAt: data.trial_ends_at,
              trialStatus: data.trial_status
            });
          }
        }
      } catch (err) {
        console.error('Error fetching usage:', err);
      }
    }

    fetchUsage();

    // Refresh usage every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!usage) {
    return (
      <button className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors">
        {displayName}
      </button>
    );
  }

  const percentage = (usage.count / usage.limit) * 100;
  const remaining = usage.limit - usage.count;
  const isLow = percentage >= 80;
  const isCritical = percentage >= 90;

  // Calculate days remaining in trial
  // Only show trial countdown if trial is still ACTIVE (not completed)
  let daysRemaining = null;
  const isTrialActive = usage.trialStatus === 'active' && usage.trialEndsAt;

  if (isTrialActive) {
    const endDate = new Date(usage.trialEndsAt);
    const now = new Date();
    const diff = endDate.getTime() - now.getTime();
    daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const isPremium = usage.tier === 'premium';
  const isBasic = usage.tier === 'basic';
  const isPaidTier = isPremium || isBasic;

  // Determine user tier display text
  const tierDisplayText = isPremium ? '✨ Premium Member'
    : isBasic ? '⭐ Basic Member'
    : '🎁 Free Trial';

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold">
          {displayName.charAt(0).toUpperCase()}
        </div>
        <span>{displayName}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {tierDisplayText}
            </p>
          </div>

          {/* Usage Stats */}
          <div className="px-4 py-3 space-y-3">
            {isPremium ? (
              <div className="px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-semibold text-center">
                ✨ Unlimited Images
              </div>
            ) : (
              <>
                {/* Image Usage */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Images Used</span>
                    <span className={`font-semibold ${isCritical ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-blue-600'}`}>
                      {usage.count} / {usage.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        isCritical
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : isLow
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                          : 'bg-gradient-to-r from-blue-500 to-blue-600'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <p className={`text-xs ${isCritical ? 'text-red-600' : isLow ? 'text-orange-600' : 'text-gray-500'}`}>
                    {remaining} images remaining
                  </p>
                </div>

                {/* Trial Timer */}
                {daysRemaining !== null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Trial Ends</span>
                      <span className={`font-semibold ${daysRemaining <= 3 ? 'text-yellow-600' : 'text-blue-600'}`}>
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                      </span>
                    </div>
                    {daysRemaining <= 3 && (
                      <p className="text-xs text-yellow-600">
                        ⏰ Your trial is ending soon!
                      </p>
                    )}
                  </div>
                )}

                {/* Upgrade CTA */}
                {(isLow || (daysRemaining !== null && daysRemaining <= 3)) && (
                  <Link
                    href="/upgrade"
                    onClick={() => setIsOpen(false)}
                    className="block w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-pink-700 transition-all shadow-md text-center"
                  >
                    ⬆️ Upgrade to Premium
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Menu Items */}
          <div className="border-t border-gray-100 mt-2">
            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ⚙️ Settings
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                🚪 Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
