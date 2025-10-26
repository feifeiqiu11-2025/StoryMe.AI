/**
 * Pricing Page
 * Displays all subscription tiers with features and pricing
 * Consistent with KindleWood Studio design system
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PricingCards from '@/components/pricing/PricingCards';

export default function PricingPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const supabase = createClient();

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
    };

    checkAuth();
  }, [supabase]);

  const handleSelectPlan = async (tierId: string) => {
    if (tierId === 'trial') {
      router.push('/signup');
      return;
    }

    // Check if user is authenticated before proceeding
    if (isAuthenticated === false) {
      // User not logged in - show friendly modal asking them to authenticate
      const shouldProceed = confirm(
        '🔒 Please sign in to continue\n\n' +
        'You need to create a free account or sign in to subscribe to a plan.\n\n' +
        'Click OK to continue (you can sign in or sign up on the next page).\n' +
        'Click Cancel to return to the pricing page.'
      );

      if (shouldProceed) {
        // Go to login page (which also has sign up option)
        router.push(`/login?redirect=/pricing&plan=${tierId}&cycle=${billingCycle}`);
      }
      // If Cancel clicked, do nothing - stay on pricing page
      return;
    }

    // If auth status is still loading, wait
    if (isAuthenticated === null) {
      console.log('Authentication status still loading...');
      return;
    }

    // Start Stripe checkout
    setLoading(tierId);

    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tier: tierId,
          cycle: billingCycle,
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        // Redirect to Stripe Checkout
        window.location.href = data.url;
      } else {
        console.error('Failed to create checkout session:', data.error);

        // Better error handling with specific messages
        if (response.status === 401) {
          alert('🔒 Please sign in first to subscribe to a plan.');
          router.push(`/login?redirect=/pricing&plan=${tierId}&cycle=${billingCycle}`);
        } else {
          alert(data.error || 'Failed to start checkout. Please try again.');
        }
        setLoading(null);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      alert('Failed to start checkout. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
        <Link href="/" className="text-lg font-bold hover:opacity-80 transition-opacity cursor-pointer text-gray-900">
          📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Studio ✨
        </Link>
        <Link
          href="/dashboard"
          className="text-gray-700 hover:text-gray-900 font-medium px-6 py-2 rounded-lg hover:bg-white/50 transition-all"
        >
          Dashboard
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Story Journey</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Start free, upgrade anytime. All plans include access to the FREE KindleWood Kids app!
          </p>

          {/* Billing Toggle */}
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

        {/* Pricing Cards Grid - Using shared component */}
        <div className="mb-12">
          <PricingCards
            billingCycle={billingCycle}
            onSelectPlan={handleSelectPlan}
            loading={loading}
          />
        </div>

        {/* Kids App Callout */}
        <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-2xl shadow-lg p-6 md:p-8 border border-green-200 mb-12">
          <div className="flex items-start gap-4">
            <div className="text-4xl">📱</div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                KindleWood Kids App - Always FREE 🎉
              </h3>
              <p className="text-gray-700 mb-4">
                All KindleWood Studio subscribers get FREE access to the KindleWood Kids app!
                Your children can read, listen, and interact with their stories on any device.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Read stories offline
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Audio narration in English & Chinese
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Interactive quizzes
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Multiple child profiles
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at the start of your next billing cycle.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-2">What happens when I reach my story limit?</h3>
              <p className="text-gray-600 text-sm">
                You'll be prompted to upgrade to continue creating new stories. Your existing stories remain accessible forever.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-2">Is the Kids app really free?</h3>
              <p className="text-gray-600 text-sm">
                Yes! The KindleWood Kids app is 100% FREE for all KindleWood Studio subscribers. No additional charges.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-semibold text-gray-900 mb-2">How does the Team plan work?</h3>
              <p className="text-gray-600 text-sm">
                The Team plan includes 5 separate KindleWood Studio accounts with unlimited stories each. Perfect for families with multiple adults or educational settings. One primary account handles billing.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <Link
            href="/signup"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
          >
            🎁 Start Your Free Trial
          </Link>
          <p className="text-gray-600 mt-4 text-sm">
            No credit card required • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
}
