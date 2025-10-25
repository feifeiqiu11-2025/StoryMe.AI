/**
 * Upgrade Page (Dashboard)
 * Shows current subscription and upgrade options
 * Integrated with Phase 2A subscription system
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { formatTierName, getTierColor, getTierPrice, formatPrice } from '@/lib/subscription/utils';

interface SubscriptionInfo {
  tier: string;
  status: string;
  storiesUsed: number;
  storiesLimit: number;
  storiesRemaining: string;
  trialDaysRemaining: number | null;
  canCreateStory: boolean;
}

export default function UpgradePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [cancelling, setCancelling] = useState(false);

  // Get plan from URL params (when user hits limit)
  const suggestedPlan = searchParams?.get('plan') || null;

  useEffect(() => {
    const loadSubscription = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        // Fetch subscription status
        const response = await fetch('/api/test-subscription');
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.summary);
        }
      } catch (error) {
        console.error('Error loading subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSubscription();
  }, [router]);

  const handleSelectPlan = (planId: string, cycle: 'monthly' | 'annual') => {
    // Will integrate with Stripe checkout
    router.push(`/pricing?plan=${planId}&cycle=${cycle}`);
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will retain access until the end of your billing period.')) {
      return;
    }

    setCancelling(true);
    try {
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert('Your subscription will be cancelled at the end of the billing period. You can continue to use all features until then.');
        // Reload subscription data
        window.location.reload();
      } else {
        alert(data.error || 'Failed to cancel subscription. Please try again.');
      }
    } catch (error) {
      console.error('Cancel subscription error:', error);
      alert('Failed to cancel subscription. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading subscription...</p>
        </div>
      </div>
    );
  }

  const currentTier = subscription?.tier || 'free';
  const isTrial = currentTier === 'free' || currentTier === 'trial';
  const isPremium = currentTier === 'premium';
  const isTeam = currentTier === 'team';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Current Subscription Status */}
        <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Your Subscription
              </h1>
              <p className="text-gray-600">
                Manage your plan and billing
              </p>
            </div>
            <div className={`px-4 py-2 rounded-full font-semibold ${getTierColor(currentTier)}`}>
              {formatTierName(currentTier)}
            </div>
          </div>

          {/* Usage Stats */}
          {subscription && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="text-sm text-gray-600 mb-1">Stories This Month</div>
                <div className="text-2xl font-bold text-gray-900">
                  {subscription.storiesUsed} / {subscription.storiesLimit === -1 ? '∞' : subscription.storiesLimit}
                </div>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                <div className="text-sm text-gray-600 mb-1">Remaining</div>
                <div className="text-2xl font-bold text-gray-900">
                  {subscription.storiesRemaining}
                </div>
              </div>

              {isTrial && subscription.trialDaysRemaining !== null && (
                <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                  <div className="text-sm text-gray-600 mb-1">Trial Days Left</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {subscription.trialDaysRemaining} days
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Alert if limit reached */}
          {subscription && !subscription.canCreateStory && (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Story Limit Reached</h3>
                  <p className="text-sm text-gray-700">
                    You've used all your stories for this {isTrial ? 'trial' : 'month'}. Upgrade to continue creating!
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {isPremium || isTeam ? 'Manage Your Plan' : 'Upgrade for More Stories'}
          </h2>

          {/* Billing Toggle */}
          {!isPremium && !isTeam && (
            <div className="flex justify-center mb-8">
              <div className="inline-flex items-center bg-white rounded-full p-1.5 shadow-md">
                <button
                  onClick={() => setBillingCycle('monthly')}
                  className={`px-6 py-2 rounded-full font-medium transition-all ${
                    billingCycle === 'monthly'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingCycle('annual')}
                  className={`px-6 py-2 rounded-full font-medium transition-all relative ${
                    billingCycle === 'annual'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Annual
                  <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                    Save 17%
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Upgrade Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Basic Plan */}
            {isTrial && (
              <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-blue-200 hover:border-blue-300 transition-all">
                <div className="mb-4">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">📖 Basic</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {formatPrice(getTierPrice('basic', billingCycle === 'annual'))}
                    <span className="text-sm font-normal text-gray-600">
                      /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                    </span>
                  </div>
                  <div className="text-sm text-blue-600 font-semibold">20 stories/month</div>
                </div>

                <ul className="space-y-2 mb-6 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-600">20 new stories per month</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-600">All story features</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">✓</span>
                    <span className="text-gray-600">FREE Kids app</span>
                  </li>
                </ul>

                <button
                  onClick={() => handleSelectPlan('basic', billingCycle)}
                  className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-md"
                >
                  Choose Basic
                </button>
              </div>
            )}

            {/* Premium Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 relative ${
              isPremium ? 'ring-2 ring-purple-500' : 'border-2 border-purple-200 hover:border-purple-300'
            } transition-all`}>
              {!isPremium && (
                <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  POPULAR
                </div>
              )}
              {isPremium && (
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  CURRENT PLAN
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">✨ Premium</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {formatPrice(getTierPrice('premium', billingCycle === 'annual'))}
                  <span className="text-sm font-normal text-gray-600">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                <div className="text-sm text-purple-600 font-semibold">Unlimited stories</div>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Unlimited story creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Everything in Basic</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Priority support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Early feature access</span>
                </li>
              </ul>

              {!isPremium && (
                <button
                  onClick={() => handleSelectPlan('premium', billingCycle)}
                  className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 transition-all shadow-md"
                >
                  Go Premium
                </button>
              )}
              {isPremium && (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-3 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="w-full bg-white border-2 border-red-300 text-red-600 py-2 rounded-lg font-medium hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                </div>
              )}
            </div>

            {/* Team Plan */}
            <div className={`bg-white rounded-2xl shadow-lg p-6 ${
              isTeam ? 'ring-2 ring-green-500' : 'border-2 border-green-200 hover:border-green-300'
            } transition-all`}>
              {isTeam && (
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                  CURRENT PLAN
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">👥 Team</h3>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {formatPrice(getTierPrice('team', billingCycle === 'annual'))}
                  <span className="text-sm font-normal text-gray-600">
                    /{billingCycle === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                <div className="text-sm text-green-600 font-semibold">5 accounts, unlimited each</div>
              </div>

              <ul className="space-y-2 mb-6 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">5 Studio accounts</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">Unlimited per account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">All Premium features</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <span className="text-gray-600">$12/user (save $2.99)</span>
                </li>
              </ul>

              {!isTeam && (
                <button
                  onClick={() => handleSelectPlan('team', billingCycle)}
                  className="w-full bg-gradient-to-r from-green-500 to-teal-500 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-teal-600 transition-all shadow-md"
                >
                  Choose Team
                </button>
              )}
              {isTeam && (
                <div className="space-y-2">
                  <button
                    disabled
                    className="w-full bg-gray-100 text-gray-400 py-3 rounded-lg font-semibold cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                  <button
                    onClick={handleCancelSubscription}
                    disabled={cancelling}
                    className="w-full bg-white border-2 border-red-300 text-red-600 py-2 rounded-lg font-medium hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Full Pricing */}
        <div className="text-center">
          <Link
            href="/pricing"
            className="inline-block text-gray-600 hover:text-gray-900 font-medium underline"
          >
            View detailed pricing comparison →
          </Link>
        </div>
      </div>
    </div>
  );
}
