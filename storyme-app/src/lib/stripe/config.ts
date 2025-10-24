/**
 * Stripe Configuration
 * Server-side Stripe setup
 */

import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set in environment variables');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
});

// Price IDs for each tier and billing cycle
export const STRIPE_PRICES = {
  basic: {
    monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_BASIC_ANNUAL || '',
  },
  premium: {
    monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_PREMIUM_ANNUAL || '',
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY || '',
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL || '',
  },
} as const;

// Validate that price IDs are set
export function validateStripeConfig() {
  const missingPrices: string[] = [];

  Object.entries(STRIPE_PRICES).forEach(([tier, prices]) => {
    if (!prices.monthly) missingPrices.push(`${tier}_monthly`);
    if (!prices.annual) missingPrices.push(`${tier}_annual`);
  });

  if (missingPrices.length > 0) {
    console.warn('Missing Stripe price IDs:', missingPrices.join(', '));
    return false;
  }

  return true;
}

// Get price ID based on tier and cycle
export function getPriceId(tier: 'basic' | 'premium' | 'team', cycle: 'monthly' | 'annual'): string {
  const priceId = STRIPE_PRICES[tier]?.[cycle];

  if (!priceId) {
    throw new Error(`Price ID not found for ${tier} ${cycle}`);
  }

  return priceId;
}
