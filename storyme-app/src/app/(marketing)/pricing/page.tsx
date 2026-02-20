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
import LandingNav from '@/components/navigation/LandingNav';

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
      {/* Navigation */}
      <LandingNav />

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your <span className="text-amber-700 underline decoration-amber-700 decoration-2 underline-offset-4">Creative Journey</span>
          </h1>
          <p className="text-xl text-gray-600 mb-4 max-w-3xl mx-auto">
            Pricing for <strong>KindleWood Studio</strong> online tools. Start free, upgrade anytime.
          </p>
          <p className="text-base text-gray-500 mb-8 max-w-2xl mx-auto">
            All plans include FREE access to the KindleWood Kids app for reading and learning.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center bg-white rounded-full p-1.5 shadow-md">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-6 py-2 rounded-full font-medium transition-all relative ${
                billingCycle === 'annual'
                  ? 'bg-purple-600 text-white shadow-md'
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

        {/* In-Person Learning Lab Coming Soon */}
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8 mb-12 max-w-2xl mx-auto">
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              In-Person Learning Lab
            </h3>
            <p className="text-amber-600 font-medium mb-4">Pricing Coming Soon</p>
            <p className="text-gray-600 max-w-lg mx-auto">
              Pricing for our in-person enrichment classes at partner schools and KindleWood Learning Lab workshops will vary based on the type of learning experience and workshop.
            </p>
            <a
              href="mailto:admin@kindlewoodstudio.ai?subject=In-Person Learning Lab Inquiry"
              className="inline-block mt-6 bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Contact Us for Details
            </a>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div className="py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Can I upgrade or downgrade anytime?</h3>
              <p className="text-gray-600 text-sm">
                Yes! You can upgrade, downgrade, or cancel your subscription at any time. Changes take effect at the start of your next billing cycle.
              </p>
            </div>

            <div className="py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">What happens when I reach my project limit?</h3>
              <p className="text-gray-600 text-sm">
                You'll be prompted to upgrade to continue creating new projects. Your existing projects remain accessible forever.
              </p>
            </div>

            <div className="py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 mb-2">Is the Kids app really free?</h3>
              <p className="text-gray-600 text-sm">
                Yes! The KindleWood Kids app is 100% FREE for all KindleWood Studio subscribers. No additional charges.
              </p>
            </div>

            <div className="py-4">
              <h3 className="font-semibold text-gray-900 mb-2">How does the Schools & Educators plan work?</h3>
              <p className="text-gray-600 text-sm">
                The Schools & Educators plan includes 5 separate KindleWood Studio accounts with unlimited projects each. Perfect for classrooms, families with multiple adults, or educational settings. One primary account handles billing.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="bg-gradient-to-b from-blue-50 to-white border-t border-blue-100">
        <div className="max-w-6xl mx-auto px-4 text-center py-8">
          {/* Footer Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-gray-600 mb-4">
            <a href="mailto:Admin@KindleWoodStudio.ai" className="hover:text-indigo-600 transition-colors">Contact</a>
            <Link href="/support" className="hover:text-indigo-600 transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms</Link>
          </div>

          {/* Copyright */}
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KindleWood Studio. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
