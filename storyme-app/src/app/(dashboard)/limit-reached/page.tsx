/**
 * Limit Reached Transition Page
 * Shows when trial users hit story limit or trial expiration
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LimitReachedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [limitInfo, setLimitInfo] = useState<{
    reason: 'trial_expired' | 'story_limit_reached';
    storiesUsed: number;
    storiesLimit: number;
  } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Get limit info from API
      try {
        const response = await fetch('/api/usage/limits');
        const data = await response.json();

        if (response.ok && !data.canCreate) {
          // Determine reason
          const reason = data.reason?.includes('trial has expired')
            ? 'trial_expired'
            : 'story_limit_reached';

          setLimitInfo({
            reason,
            storiesUsed: data.storiesUsed || 0,
            storiesLimit: data.storiesLimit || 5,
          });
        } else {
          // User can create stories, redirect to create page
          router.push('/create');
          return;
        }
      } catch (error) {
        console.error('Error checking limits:', error);
        // On error, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading || !limitInfo) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const isTrialExpired = limitInfo.reason === 'trial_expired';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
              <span className="text-4xl">
                {isTrialExpired ? '⏰' : '📚'}
              </span>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-4">
            {isTrialExpired
              ? 'Your Trial Has Ended'
              : 'Story Limit Reached'}
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-600 text-center mb-8">
            {isTrialExpired ? (
              <>
                Looks like your <strong>7-day free trial</strong> has ended.
                Upgrade to <strong>Basic</strong> or <strong>Premium</strong> to
                continue creating amazing personalized stories!
              </>
            ) : (
              <>
                You've created <strong>{limitInfo.storiesUsed} out of {limitInfo.storiesLimit}</strong> free
                trial stories. Upgrade to get <strong>more stories every month</strong> or
                go <strong>unlimited with Premium</strong>!
              </>
            )}
          </p>

          {/* Benefits Section */}
          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 text-center">
              Upgrade to unlock:
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Basic Tier - Clickable */}
              <button
                onClick={() => router.push('/upgrade?plan=basic')}
                className="bg-white rounded-xl p-4 shadow-sm hover:shadow-lg transition-all border-2 border-transparent hover:border-purple-300 text-left"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">⭐</span>
                  <h3 className="font-bold text-gray-900">Basic Plan</h3>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-3">$8.99<span className="text-sm text-gray-500">/month</span></p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>20 stories</strong> per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>AI-powered illustrations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Export to PDF</span>
                  </li>
                </ul>
                <div className="mt-4 text-center text-sm font-semibold text-purple-600">
                  Select Basic →
                </div>
              </button>

              {/* Premium Tier - Clickable */}
              <button
                onClick={() => router.push('/upgrade?plan=premium')}
                className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl p-4 shadow-sm hover:shadow-lg transition-all border-2 border-purple-300 hover:border-purple-500 text-left"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="font-bold text-gray-900">Premium</h3>
                  </div>
                  <span className="text-xs font-bold bg-purple-600 text-white px-2 py-1 rounded-full">POPULAR</span>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-3">$14.99<span className="text-sm text-gray-500">/month</span></p>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span><strong>Unlimited stories</strong></span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>Priority support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 mt-0.5">✓</span>
                    <span>All Basic features</span>
                  </li>
                </ul>
                <div className="mt-4 text-center text-sm font-semibold text-purple-600">
                  Select Premium →
                </div>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/upgrade')}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl hover:from-purple-700 hover:to-pink-700 font-bold text-lg shadow-lg transition-all transform hover:scale-105"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => router.push('/dashboard')}
              className="flex-1 bg-gray-100 text-gray-700 px-8 py-4 rounded-xl hover:bg-gray-200 font-semibold text-lg transition-all"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
