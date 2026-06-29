/**
 * Fix trial_status for users who have upgraded to paid subscriptions
 *
 * Issue: When users upgrade from trial to paid subscription,
 * trial_status remains 'active' instead of being set to 'completed'
 *
 * This causes the UI to show trial-related info instead of subscription tier
 */

-- Update trial_status to 'completed' for all users with active paid subscriptions
UPDATE users
SET trial_status = 'completed'
WHERE
  subscription_tier IN ('basic', 'premium', 'team')
  AND subscription_status = 'active'
  AND stripe_subscription_id IS NOT NULL
  AND trial_status = 'active';

-- Verify the fix
SELECT
  email,
  subscription_tier,
  subscription_status,
  trial_status,
  stories_limit,
  stripe_subscription_id IS NOT NULL as has_stripe_subscription
FROM users
WHERE email = 'feifeiqiu11@gmail.com';
