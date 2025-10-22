-- Debug image generation limits for feifei_qiu@hotmail.com
-- Run this in Supabase SQL Editor to diagnose the issue

-- Step 1: Check user account details
SELECT
    id,
    email,
    subscription_tier,
    trial_status,
    images_generated_count,
    images_limit,
    created_at,
    trial_ends_at
FROM users
WHERE email = 'feifei_qiu@hotmail.com';

-- Expected:
-- images_limit: 1000 (you just updated this)
-- images_generated_count: ??? (check if this is >= 50 or >= 100)
-- subscription_tier: 'free' or 'paid'
-- trial_status: 'active', 'expired', or null


-- Step 2: Check daily image count (last 24 hours)
-- This function is used by the rate limit code
SELECT get_daily_image_count((
    SELECT id FROM users WHERE email = 'feifei_qiu@hotmail.com'
)) as daily_count;

-- If this returns >= 100, that's why you're getting rate limited!


-- Step 3: Check recent API usage logs
SELECT
    created_at,
    endpoint,
    status_code,
    images_generated,
    error_message
FROM api_usage_logs
WHERE user_id = (SELECT id FROM users WHERE email = 'feifei_qiu@hotmail.com')
ORDER BY created_at DESC
LIMIT 20;


-- ===== SOLUTIONS =====

-- Solution 1: Reset images_generated_count (if trial limit is the issue)
UPDATE users
SET images_generated_count = 0
WHERE email = 'feifei_qiu@hotmail.com';


-- Solution 2: Upgrade to 'paid' tier (removes trial limit + daily limit)
UPDATE users
SET
    subscription_tier = 'paid',
    trial_status = NULL,
    images_limit = -1  -- -1 means unlimited
WHERE email = 'feifei_qiu@hotmail.com';


-- Solution 3: Keep as trial but reset count and increase limit
UPDATE users
SET
    images_generated_count = 0,
    images_limit = 1000,
    trial_ends_at = NOW() + INTERVAL '30 days'  -- Extend trial
WHERE email = 'feifei_qiu@hotmail.com';


-- Step 4: Verify the fix
SELECT
    id,
    email,
    subscription_tier,
    trial_status,
    images_generated_count,
    images_limit,
    trial_ends_at
FROM users
WHERE email = 'feifei_qiu@hotmail.com';
