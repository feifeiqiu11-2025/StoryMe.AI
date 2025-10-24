/**
 * Subscription Middleware
 * Checks if user can create stories based on their subscription tier and limits
 */

import { createClient } from '@/lib/supabase/server';

export interface SubscriptionStatus {
  canCreate: boolean;
  reason?: string;
  storiesUsed: number;
  storiesLimit: number;
  tier: string;
  status: string;
  trialEndsAt?: string;
}

/**
 * Check if user can create a new story
 * Returns detailed status about subscription and usage
 */
export async function checkStoryCreationLimit(userId: string): Promise<SubscriptionStatus> {
  const supabase = await createClient();

  // Get user's subscription details
  // Note: using trial_ends_at (existing field) instead of trial_end_date
  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_tier, subscription_status, stories_created_this_month, stories_limit, trial_ends_at')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return {
      canCreate: false,
      reason: 'Unable to verify subscription status',
      storiesUsed: 0,
      storiesLimit: 0,
      tier: 'unknown',
      status: 'unknown',
    };
  }

  const {
    subscription_tier,
    subscription_status,
    stories_created_this_month,
    stories_limit,
    trial_ends_at,
  } = user;

  // Check if subscription is active
  if (subscription_status !== 'active' && subscription_status !== 'trialing') {
    return {
      canCreate: false,
      reason: 'Your subscription is not active. Please update your payment method or upgrade.',
      storiesUsed: stories_created_this_month || 0,
      storiesLimit: stories_limit || 0,
      tier: subscription_tier || 'unknown',
      status: subscription_status || 'unknown',
    };
  }

  // Check if trial has expired
  // Note: 'free' and 'trial' both represent trial users (backward compatibility)
  const isTrialTier = subscription_tier === 'trial' || subscription_tier === 'free';
  if (isTrialTier && trial_ends_at) {
    const trialEndDate = new Date(trial_ends_at);
    const now = new Date();

    if (trialEndDate < now) {
      return {
        canCreate: false,
        reason: 'Your free trial has expired. Upgrade to Basic or Premium to continue creating stories.',
        storiesUsed: stories_created_this_month || 0,
        storiesLimit: stories_limit || 0,
        tier: subscription_tier,
        status: subscription_status || 'expired',
        trialEndsAt: trial_ends_at,
      };
    }
  }

  // Unlimited tiers (Premium, Team)
  if (stories_limit === -1) {
    return {
      canCreate: true,
      storiesUsed: stories_created_this_month || 0,
      storiesLimit: -1,
      tier: subscription_tier || 'unknown',
      status: subscription_status || 'active',
      trialEndsAt: trial_ends_at,
    };
  }

  // Check if user has reached their limit
  const currentCount = stories_created_this_month || 0;
  if (currentCount >= stories_limit) {
    return {
      canCreate: false,
      reason: `You've reached your monthly limit of ${stories_limit} stories. Upgrade to Premium for unlimited stories or wait until your next billing cycle.`,
      storiesUsed: currentCount,
      storiesLimit: stories_limit,
      tier: subscription_tier || 'unknown',
      status: subscription_status || 'active',
      trialEndsAt: trial_ends_at,
    };
  }

  // User can create a story
  return {
    canCreate: true,
    storiesUsed: currentCount,
    storiesLimit: stories_limit,
    tier: subscription_tier || 'unknown',
    status: subscription_status || 'active',
    trialEndsAt: trial_ends_at,
  };
}

/**
 * Increment story count for user
 * Should be called after a story is successfully created
 */
export async function incrementStoryCount(userId: string): Promise<void> {
  const supabase = await createClient();

  // Call the database function to increment count
  const { error } = await supabase.rpc('increment_story_count', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error incrementing story count:', error);
    throw new Error('Failed to update story count');
  }
}

/**
 * Get usage tracking for current billing period
 */
export async function getCurrentUsageTracking(userId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('get_or_create_usage_tracking', {
    p_user_id: userId,
  });

  if (error) {
    console.error('Error getting usage tracking:', error);
    return null;
  }

  return data;
}

/**
 * Check if user can perform an action that doesn't count toward limit
 * (e.g., translation, viewing, downloading)
 */
export async function checkFreeAction(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('subscription_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    return false;
  }

  // Free actions are allowed as long as subscription is active or trialing
  return user.subscription_status === 'active' || user.subscription_status === 'trialing';
}

/**
 * Get user's subscription summary
 */
export async function getSubscriptionSummary(userId: string) {
  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select(`
      subscription_tier,
      subscription_status,
      stories_created_this_month,
      stories_limit,
      trial_started_at,
      trial_ends_at,
      billing_cycle_start,
      annual_subscription,
      team_id,
      is_team_primary
    `)
    .eq('id', userId)
    .single();

  if (error || !user) {
    return null;
  }

  // Calculate days remaining in trial
  // Note: 'free' and 'trial' both represent trial users (backward compatibility)
  let trialDaysRemaining = null;
  const isTrialTier = user.subscription_tier === 'trial' || user.subscription_tier === 'free';
  if (isTrialTier && user.trial_ends_at) {
    const trialEnd = new Date(user.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  return {
    ...user,
    trialDaysRemaining,
    isUnlimited: user.stories_limit === -1,
    percentUsed: user.stories_limit > 0
      ? Math.round((user.stories_created_this_month / user.stories_limit) * 100)
      : 0,
  };
}
