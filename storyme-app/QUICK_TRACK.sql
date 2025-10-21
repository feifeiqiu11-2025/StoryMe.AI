-- ============================================
-- QUICK API USAGE TRACKING
-- Run this in Supabase SQL Editor while testing
-- Refresh the query to see real-time updates
-- ============================================

-- QUERY 1: Last 10 API calls (refresh this while testing!)
SELECT
  endpoint,
  method,
  status_code,
  images_generated,
  error_message,
  response_time_ms,
  TO_CHAR(created_at AT TIME ZONE 'America/New_York', 'HH24:MI:SS') as time
FROM api_usage_logs
ORDER BY created_at DESC
LIMIT 10;

-- QUERY 2: Your current usage summary
SELECT
  COUNT(*) as total_api_calls,
  SUM(images_generated) as total_images_generated,
  SUM(CASE WHEN status_code = 200 THEN 1 ELSE 0 END) as successful_calls,
  SUM(CASE WHEN status_code = 429 THEN 1 ELSE 0 END) as rate_limited_calls,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as error_calls
FROM api_usage_logs
WHERE created_at >= NOW() - INTERVAL '1 day';

-- QUERY 3: Check if you're close to rate limit
SELECT
  u.email,
  u.images_generated_count as total_ever,
  get_daily_image_count(u.id) as used_today,
  100 - get_daily_image_count(u.id) as remaining_today,
  CASE
    WHEN u.trial_status = 'active' THEN 50 - u.images_generated_count
    ELSE NULL
  END as trial_remaining
FROM users u
WHERE u.email IS NOT NULL
ORDER BY u.created_at DESC
LIMIT 1;
