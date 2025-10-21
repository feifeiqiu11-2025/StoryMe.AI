-- ============================================
-- API Usage Tracking Queries
-- Run these in Supabase SQL Editor while testing
-- ============================================

-- Query 1: Real-time API usage logs (refresh this while testing)
SELECT
  user_id,
  endpoint,
  method,
  status_code,
  images_generated,
  response_time_ms,
  error_message,
  created_at AT TIME ZONE 'UTC' as timestamp_utc
FROM api_usage_logs
ORDER BY created_at DESC
LIMIT 20;

-- Query 2: Current daily usage by user
SELECT
  u.email,
  u.id as user_id,
  get_daily_image_count(u.id) as images_used_today,
  u.images_generated_count as total_images_ever,
  u.subscription_tier,
  u.trial_status
FROM users u
WHERE u.email IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 10;

-- Query 3: Check if you're hitting rate limits
SELECT
  u.email,
  get_daily_image_count(u.id) as daily_used,
  CASE
    WHEN u.subscription_tier = 'free' THEN 100
    ELSE 100
  END as daily_limit,
  100 - get_daily_image_count(u.id) as daily_remaining,
  CASE
    WHEN u.trial_status = 'active' AND u.subscription_tier = 'free' THEN u.images_generated_count
    ELSE NULL
  END as trial_total_used,
  CASE
    WHEN u.trial_status = 'active' AND u.subscription_tier = 'free' THEN 50
    ELSE NULL
  END as trial_total_limit,
  CASE
    WHEN u.trial_status = 'active' AND u.subscription_tier = 'free' THEN 50 - u.images_generated_count
    ELSE NULL
  END as trial_remaining
FROM users u
WHERE u.email IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 5;

-- Query 4: Error tracking (check for rate limit errors)
SELECT
  endpoint,
  status_code,
  error_message,
  images_generated,
  created_at AT TIME ZONE 'UTC' as timestamp_utc
FROM api_usage_logs
WHERE status_code >= 400
ORDER BY created_at DESC
LIMIT 10;

-- Query 5: Performance monitoring
SELECT
  endpoint,
  COUNT(*) as total_calls,
  AVG(response_time_ms) as avg_response_ms,
  MAX(response_time_ms) as max_response_ms,
  MIN(response_time_ms) as min_response_ms,
  SUM(images_generated) as total_images
FROM api_usage_logs
WHERE created_at >= NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY total_calls DESC;
