/**
 * Rate Limiting Utilities
 * Simple database-based rate limiting with clear user messages
 */

import { createClient } from '@/lib/supabase/server';

export interface RateLimitConfig {
  dailyLimit: number;
  hourlyLimit: number;
  totalTrialLimit?: number; // For trial users only
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  limits?: {
    daily: { used: number; limit: number; remaining: number };
    hourly: { used: number; limit: number; remaining: number };
    total?: { used: number; limit: number; remaining: number };
  };
}

/**
 * Default rate limits based on subscription tier
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    dailyLimit: 100,
    hourlyLimit: 20,
    totalTrialLimit: 50, // Total images during trial
  },
  paid: {
    dailyLimit: 100,
    hourlyLimit: 20,
    // No total limit for paid users
  },
};

/**
 * Check if user can generate images based on rate limits
 */
export async function checkImageGenerationLimit(
  userId: string,
  imageCount: number = 1
): Promise<RateLimitResult> {
  const supabase = await createClient();

  // Get user info to determine limits
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('subscription_tier, trial_status, images_generated_count, images_limit')
    .eq('id', userId)
    .single();

  if (userError || !user) {
    return {
      allowed: false,
      reason: 'Unable to verify user account. Please try again.',
    };
  }

  // Check if user has unlimited images (images_limit = -1)
  const isUnlimited = user.images_limit === -1;

  if (isUnlimited) {
    return {
      allowed: true,
      limits: {
        daily: { used: 0, limit: -1, remaining: -1 },
        hourly: { used: 0, limit: -1, remaining: -1 },
      },
    };
  }

  // Determine rate limits based on subscription tier
  const isTrial = user.subscription_tier === 'free' && user.trial_status === 'active';
  const config = RATE_LIMITS[user.subscription_tier] || RATE_LIMITS.free;

  // Check total trial limit (if applicable)
  if (isTrial && config.totalTrialLimit) {
    const totalUsed = user.images_generated_count || 0;
    const totalRemaining = config.totalTrialLimit - totalUsed;

    if (totalUsed >= config.totalTrialLimit) {
      return {
        allowed: false,
        reason: `You've reached your trial limit of ${config.totalTrialLimit} images. Upgrade to continue creating stories!`,
        limits: {
          daily: { used: 0, limit: config.dailyLimit, remaining: config.dailyLimit },
          hourly: { used: 0, limit: config.hourlyLimit, remaining: config.hourlyLimit },
          total: { used: totalUsed, limit: config.totalTrialLimit, remaining: 0 },
        },
      };
    }

    if (totalUsed + imageCount > config.totalTrialLimit) {
      return {
        allowed: false,
        reason: `This would exceed your trial limit. You have ${totalRemaining} image${totalRemaining === 1 ? '' : 's'} remaining. Try generating fewer scenes or upgrade for unlimited images!`,
        limits: {
          daily: { used: 0, limit: config.dailyLimit, remaining: config.dailyLimit },
          hourly: { used: 0, limit: config.hourlyLimit, remaining: config.hourlyLimit },
          total: { used: totalUsed, limit: config.totalTrialLimit, remaining: totalRemaining },
        },
      };
    }
  }

  // Get daily usage
  const { data: dailyCount } = await supabase.rpc('get_daily_image_count', {
    p_user_id: userId,
  });

  const dailyUsed = dailyCount || 0;
  const dailyRemaining = Math.max(0, config.dailyLimit - dailyUsed);

  if (dailyUsed >= config.dailyLimit) {
    return {
      allowed: false,
      reason: `You've reached your daily limit of ${config.dailyLimit} images. Please try again tomorrow or upgrade for more images!`,
      limits: {
        daily: { used: dailyUsed, limit: config.dailyLimit, remaining: 0 },
        hourly: { used: 0, limit: config.hourlyLimit, remaining: config.hourlyLimit },
      },
    };
  }

  if (dailyUsed + imageCount > config.dailyLimit) {
    return {
      allowed: false,
      reason: `This would exceed your daily limit. You have ${dailyRemaining} image${dailyRemaining === 1 ? '' : 's'} remaining today. Try generating fewer scenes!`,
      limits: {
        daily: { used: dailyUsed, limit: config.dailyLimit, remaining: dailyRemaining },
        hourly: { used: 0, limit: config.hourlyLimit, remaining: config.hourlyLimit },
      },
    };
  }

  // COMMENTED OUT: Hourly limit (burst protection) - only using daily limit for now
  /*
  const { data: hourlyCount } = await supabase.rpc('get_hourly_image_count', {
    p_user_id: userId,
  });

  const hourlyUsed = hourlyCount || 0;
  const hourlyRemaining = Math.max(0, config.hourlyLimit - hourlyUsed);

  if (hourlyUsed >= config.hourlyLimit) {
    const minutesUntilReset = 60 - new Date().getMinutes();
    return {
      allowed: false,
      reason: `You're generating images too quickly! Please wait ${minutesUntilReset} minute${minutesUntilReset === 1 ? '' : 's'} before trying again.`,
      limits: {
        daily: { used: dailyUsed, limit: config.dailyLimit, remaining: dailyRemaining },
        hourly: { used: hourlyUsed, limit: config.hourlyLimit, remaining: 0 },
      },
    };
  }

  if (hourlyUsed + imageCount > config.hourlyLimit) {
    const minutesUntilReset = 60 - new Date().getMinutes();
    return {
      allowed: false,
      reason: `You can only generate ${config.hourlyLimit} images per hour. You have ${hourlyRemaining} remaining. Please wait ${minutesUntilReset} minute${minutesUntilReset === 1 ? '' : 's'} or try fewer scenes.`,
      limits: {
        daily: { used: dailyUsed, limit: config.dailyLimit, remaining: dailyRemaining },
        hourly: { used: hourlyUsed, limit: config.hourlyLimit, remaining: hourlyRemaining },
      },
    };
  }
  */

  // For now, just set hourly to 0 for return value
  const hourlyUsed = 0;
  const hourlyRemaining = config.hourlyLimit;

  // All checks passed
  const totalUsed = isTrial ? (user.images_generated_count || 0) : undefined;
  const totalLimit = isTrial ? config.totalTrialLimit : undefined;

  return {
    allowed: true,
    limits: {
      daily: { used: dailyUsed, limit: config.dailyLimit, remaining: dailyRemaining },
      hourly: { used: hourlyUsed, limit: config.hourlyLimit, remaining: hourlyRemaining },
      ...(totalUsed !== undefined && totalLimit !== undefined
        ? { total: { used: totalUsed, limit: totalLimit, remaining: totalLimit - totalUsed } }
        : {}),
    },
  };
}

/**
 * Log API usage for tracking and rate limiting
 */
export async function logApiUsage(params: {
  userId?: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  imagesGenerated?: number;
  scenesEnhanced?: number;
  charactersCreated?: number;
  errorMessage?: string;
  requestId?: string;
}) {
  const supabase = await createClient();

  await supabase.from('api_usage_logs').insert({
    user_id: params.userId,
    is_guest: !params.userId,
    endpoint: params.endpoint,
    method: params.method,
    status_code: params.statusCode,
    response_time_ms: params.responseTimeMs,
    images_generated: params.imagesGenerated || 0,
    scenes_enhanced: params.scenesEnhanced || 0,
    characters_created: params.charactersCreated || 0,
    error_message: params.errorMessage,
    request_id: params.requestId,
  });
}

/**
 * Get current usage for a user
 */
export async function getUserUsage(userId: string) {
  const supabase = await createClient();

  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('subscription_tier, trial_status, images_generated_count, images_limit')
    .eq('id', userId)
    .single();

  if (!user) return null;

  const isTrial = user.subscription_tier === 'free' && user.trial_status === 'active';
  const config = RATE_LIMITS[user.subscription_tier] || RATE_LIMITS.free;

  // Get daily count
  const { data: dailyCount } = await supabase.rpc('get_daily_image_count', {
    p_user_id: userId,
  });

  // COMMENTED OUT: Hourly count - only using daily limit for now
  // const { data: hourlyCount } = await supabase.rpc('get_hourly_image_count', {
  //   p_user_id: userId,
  // });

  return {
    daily: {
      used: dailyCount || 0,
      limit: config.dailyLimit,
      remaining: Math.max(0, config.dailyLimit - (dailyCount || 0)),
    },
    hourly: {
      used: 0, // Not tracking hourly for now
      limit: config.hourlyLimit,
      remaining: config.hourlyLimit,
    },
    ...(isTrial && config.totalTrialLimit
      ? {
          total: {
            used: user.images_generated_count || 0,
            limit: config.totalTrialLimit,
            remaining: Math.max(0, config.totalTrialLimit - (user.images_generated_count || 0)),
          },
        }
      : {}),
  };
}
