/**
 * Check if user has exceeded their image generation limit
 * This middleware checks trial limits and subscription status
 */

import { createClient } from '@/lib/supabase/server';

export interface ImageLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
  remaining: number;
  trialExpired?: boolean;
  isPremium?: boolean;
}

export async function checkImageLimit(userId: string): Promise<ImageLimitResult> {
  const supabase = await createClient();

  try {
    // Call the database function to check limit
    const { data, error } = await supabase.rpc('check_image_limit', {
      user_uuid: userId
    });

    if (error) {
      console.error('Error checking image limit:', error);
      // Default to denied on error
      return {
        allowed: false,
        count: 0,
        limit: 0,
        remaining: 0
      };
    }

    // The function returns an array with one row
    if (data && data.length > 0) {
      const result = data[0];
      return {
        allowed: result.allowed,
        count: result.count,
        limit: result.limit_val,
        remaining: result.remaining,
        trialExpired: result.trial_expired,
        isPremium: result.limit_val === -1
      };
    }

    // User not found
    return {
      allowed: false,
      count: 0,
      limit: 0,
      remaining: 0
    };
  } catch (err) {
    console.error('Unexpected error in checkImageLimit:', err);
    return {
      allowed: false,
      count: 0,
      limit: 0,
      remaining: 0
    };
  }
}

/**
 * Get user's current usage stats without checking limit
 */
export async function getUserUsageStats(userId: string) {
  const supabase = await createClient();

  const { data: user, error } = await supabase
    .from('users')
    .select('images_generated_count, images_limit, subscription_tier, trial_ends_at, trial_status')
    .eq('id', userId)
    .single();

  if (error || !user) {
    console.error('Error fetching user usage stats:', error);
    return null;
  }

  return {
    count: user.images_generated_count || 0,
    limit: user.images_limit || 50,
    remaining: Math.max(0, (user.images_limit || 50) - (user.images_generated_count || 0)),
    tier: user.subscription_tier,
    trialEndsAt: user.trial_ends_at,
    trialStatus: user.trial_status,
    isPremium: user.subscription_tier === 'premium'
  };
}
