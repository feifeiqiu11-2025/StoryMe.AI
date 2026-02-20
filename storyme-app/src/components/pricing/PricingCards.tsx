/**
 * Shared Pricing Cards Component
 * Used on both pricing page and landing page for consistency
 */

'use client';

import Link from 'next/link';

export interface PricingTier {
  id: string;
  name: string;
  displayName: string;
  price: { monthly: number; annual: number };
  description: string;
  features: string[];
  highlighted?: boolean;
  storiesLimit: string;
  cta: string;
  gradient: string;
}

export const pricingTiers: PricingTier[] = [
  {
    id: 'trial',
    name: 'Free Trial',
    displayName: 'Free Trial',
    price: { monthly: 0, annual: 0 },
    description: '',
    storiesLimit: '2 projects total',
    features: [
      '2 projects to create',
      '7 days access',
      'AI-powered creation',
      'Audio narration (EN + ZH)',
      'High-quality PDF download',
      'Spotify publishing',
      'FREE Kids app access',
      'All Premium features',
    ],
    cta: 'Start Free Trial',
    gradient: 'from-gray-400 to-gray-500',
  },
  {
    id: 'basic',
    name: 'Casual Creator',
    displayName: 'Casual Creator',
    price: { monthly: 8.99, annual: 89 },
    description: '',
    storiesLimit: '10 projects/month',
    features: [
      '10 new projects per month',
      'AI-powered creation',
      'Audio narration (EN + ZH)',
      'High-quality PDF download',
      'Spotify publishing',
      'FREE Kids app access',
      'Unlimited child profiles',
      'Quiz generation',
      'FREE translation',
    ],
    cta: 'Choose Casual',
    gradient: 'from-blue-500 to-indigo-500',
  },
  {
    id: 'premium',
    name: 'Pro Creator',
    displayName: 'Pro Creator',
    price: { monthly: 14.99, annual: 149 },
    description: '',
    storiesLimit: 'Unlimited projects',
    features: [
      'Unlimited project creation',
      'Everything in Casual Creator',
      'Priority support',
      'Early access to features',
      'No limits ever',
    ],
    highlighted: true,
    cta: 'Go Pro',
    gradient: 'from-purple-500 to-pink-500',
  },
  {
    id: 'team',
    name: 'Schools & Educators',
    displayName: 'Schools & Educators',
    price: { monthly: 59.99, annual: 599 },
    description: '',
    storiesLimit: 'Unlimited per account',
    features: [
      '5 separate Studio accounts',
      'Unlimited projects per account',
      'All Pro Creator features',
      'Priority support for all',
      'Shared billing',
      '$12/user (save $2.99)',
    ],
    cta: 'Choose Plan',
    gradient: 'from-green-500 to-teal-500',
  },
];

interface PricingCardsProps {
  billingCycle?: 'monthly' | 'annual';
  onSelectPlan?: (tierId: string) => void;
  loading?: string | null;
  // For landing page, we just link to signup
  simpleMode?: boolean;
}

export default function PricingCards({
  billingCycle = 'monthly',
  onSelectPlan,
  loading = null,
  simpleMode = false,
}: PricingCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {pricingTiers.map((tier) => {
        const price = billingCycle === 'monthly' ? tier.price.monthly : tier.price.annual;
        const priceDisplay = price === 0 ? 'Free' : billingCycle === 'monthly' ? `$${price}/mo` : `$${price}/yr`;

        return (
          <div
            key={tier.id}
            className="bg-white rounded-2xl shadow-lg p-6 flex flex-col relative overflow-hidden transition-all transform hover:-translate-y-1 hover:shadow-xl hover:ring-2 hover:ring-purple-400"
          >
            {/* Popular Badge */}
            {tier.highlighted && (
              <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                POPULAR
              </div>
            )}

            {/* Header */}
            <div className="mb-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{tier.displayName}</h3>
              {tier.description && <p className="text-sm text-gray-600 mb-4">{tier.description}</p>}

              {/* Price */}
              <div className="mb-2">
                <span className="text-4xl font-bold text-gray-900">{priceDisplay}</span>
                {price > 0 && billingCycle === 'annual' && (
                  <div className="text-sm text-gray-500 mt-1">
                    ${(price / 12).toFixed(2)}/month billed annually
                  </div>
                )}
              </div>

              {/* Stories Limit */}
              <div className="inline-block bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                {tier.storiesLimit}
              </div>
            </div>

            {/* Features List */}
            <ul className="space-y-3 mb-6 flex-grow">
              {tier.features.map((feature, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5 flex-shrink-0">✓</span>
                  <span className="text-gray-600">{feature}</span>
                </li>
              ))}
            </ul>

            {/* CTA Button */}
            {simpleMode ? (
              <Link
                href="/signup"
                className={`w-full py-3 rounded-lg font-semibold transition-all hover:shadow-lg text-center block ${
                  tier.id === 'trial'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : tier.id === 'basic'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : tier.id === 'premium'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {tier.cta}
              </Link>
            ) : (
              <button
                onClick={() => onSelectPlan?.(tier.id)}
                disabled={loading === tier.id}
                className={`w-full py-3 rounded-lg font-semibold transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                  tier.id === 'trial'
                    ? 'bg-gray-600 hover:bg-gray-700 text-white'
                    : tier.id === 'basic'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : tier.id === 'premium'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {loading === tier.id ? 'Loading...' : tier.cta}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
