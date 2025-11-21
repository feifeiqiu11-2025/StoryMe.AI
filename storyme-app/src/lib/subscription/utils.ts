/**
 * Subscription Utilities
 * Helper functions for subscription management
 */

/**
 * Format tier name for display
 */
export function formatTierName(tier: string): string {
  const tierMap: Record<string, string> = {
    free: 'Free Trial', // backward compatibility
    trial: 'Free Trial',
    basic: 'Basic',
    premium: 'Premium',
    team: 'Team',
  };

  return tierMap[tier] || tier;
}

/**
 * Get tier color for UI display
 */
export function getTierColor(tier: string): string {
  const colorMap: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800', // backward compatibility
    trial: 'bg-gray-100 text-gray-800',
    basic: 'bg-blue-100 text-blue-800',
    premium: 'bg-purple-100 text-purple-800',
    team: 'bg-green-100 text-green-800',
  };

  return colorMap[tier] || 'bg-gray-100 text-gray-800';
}

/**
 * Get tier price
 */
export function getTierPrice(tier: string, annual: boolean = false): number {
  const monthlyPrices: Record<string, number> = {
    free: 0, // backward compatibility
    trial: 0,
    basic: 8.99,
    premium: 14.99,
    team: 59.99,
  };

  const annualPrices: Record<string, number> = {
    free: 0, // backward compatibility
    trial: 0,
    basic: 89,
    premium: 149,
    team: 599,
  };

  return annual ? annualPrices[tier] : monthlyPrices[tier];
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Calculate annual savings
 */
export function calculateAnnualSavings(tier: string): number {
  const monthlyPrice = getTierPrice(tier, false);
  const annualPrice = getTierPrice(tier, true);

  const monthlyTotal = monthlyPrice * 12;
  return monthlyTotal - annualPrice;
}

/**
 * Get tier features
 */
export function getTierFeatures(tier: string): string[] {
  const trialFeatures = [
    'Up to 2 stories',
    '7 days duration',
    'All Premium features',
    'AI story generation',
    'Audio narration (EN + ZH)',
    'PDF download',
    'Spotify publishing',
    'Kids app access',
  ];

  const features: Record<string, string[]> = {
    free: trialFeatures, // backward compatibility
    trial: trialFeatures,
    basic: [
      '20 new stories per month',
      'AI story generation',
      'Audio narration (EN + ZH)',
      'High-quality PDF download',
      'Spotify publishing',
      'Kids app access (FREE)',
      'Unlimited child profiles',
      'Quiz generation',
      'Reading analytics',
      'FREE translation',
    ],
    premium: [
      'Unlimited story creation',
      'Everything in Basic +',
      'Priority support',
      'Early access to features',
      'Advanced analytics (soon)',
      'No story limits ever',
    ],
    team: [
      '5 separate Studio accounts',
      'Unlimited stories per account',
      'All Premium features',
      'Priority support for all',
      'Shared billing',
      '$12/user (save $2.99)',
    ],
  };

  return features[tier] || [];
}

/**
 * Check if tier is unlimited
 */
export function isUnlimitedTier(tier: string): boolean {
  return tier === 'premium' || tier === 'team';
}

/**
 * Get next billing date
 */
export function getNextBillingDate(billingCycleStart: string): Date {
  const start = new Date(billingCycleStart);
  const next = new Date(start);
  next.setMonth(next.getMonth() + 1);
  return next;
}

/**
 * Format date for display
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Calculate days until date
 */
export function daysUntil(date: string | Date): number {
  const target = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffTime = target.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Get upgrade recommendation based on usage
 */
export function getUpgradeRecommendation(
  tier: string,
  storiesUsed: number,
  storiesLimit: number
): {
  shouldUpgrade: boolean;
  reason: string;
  recommendedTier: string;
} | null {
  // Trial users approaching limit (handle both 'free' and 'trial')
  const isTrialTier = tier === 'trial' || tier === 'free';
  if (isTrialTier && storiesUsed >= 4) {
    return {
      shouldUpgrade: true,
      reason: "You're almost out of trial stories",
      recommendedTier: 'basic',
    };
  }

  // Basic users approaching limit
  if (tier === 'basic' && storiesLimit > 0) {
    const percentUsed = (storiesUsed / storiesLimit) * 100;

    if (percentUsed >= 90) {
      return {
        shouldUpgrade: true,
        reason: "You've used 90% of your monthly stories",
        recommendedTier: 'premium',
      };
    }

    // If they consistently use all their stories
    if (storiesUsed >= storiesLimit) {
      return {
        shouldUpgrade: true,
        reason: "You've reached your monthly limit",
        recommendedTier: 'premium',
      };
    }
  }

  return null;
}

/**
 * Get status badge properties
 */
export function getStatusBadge(status: string): {
  label: string;
  color: string;
} {
  const badges: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'bg-green-100 text-green-800' },
    trialing: { label: 'Trial', color: 'bg-blue-100 text-blue-800' },
    cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800' },
    past_due: { label: 'Past Due', color: 'bg-yellow-100 text-yellow-800' },
    incomplete: { label: 'Incomplete', color: 'bg-orange-100 text-orange-800' },
  };

  return badges[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
}
