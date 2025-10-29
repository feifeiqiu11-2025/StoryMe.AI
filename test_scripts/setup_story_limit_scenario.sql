-- Test Script: Setup "5 Story Limit Reached" Scenario for markfaye2025@gmail.com
-- This simulates a trial user who has used all 5 free stories

-- Step 1: Find the user
SELECT
  id,
  email,
  subscription_tier,
  subscription_status,
  trial_status,
  stories_created_this_month,
  stories_limit,
  trial_ends_at,
  billing_cycle_start
FROM users
WHERE email = 'markfaye2025@gmail.com';

-- Step 2: Update user to have created 5 stories (hitting the limit)
-- This sets them at exactly the limit
UPDATE users
SET
  stories_created_this_month = 5,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() + INTERVAL '3 days'  -- Trial still active for 3 more days
WHERE email = 'markfaye2025@gmail.com';

-- Step 3: Verify the update
SELECT
  id,
  email,
  subscription_tier,
  subscription_status,
  trial_status,
  stories_created_this_month,
  stories_limit,
  trial_ends_at,
  billing_cycle_start,
  -- Calculate how many days left in trial
  EXTRACT(DAY FROM (trial_ends_at - NOW())) as days_left_in_trial
FROM users
WHERE email = 'markfaye2025@gmail.com';

-- Step 4: Check what the limit check API will return
-- This shows the logic that will be evaluated
SELECT
  email,
  subscription_tier,
  trial_status,
  stories_created_this_month as stories_used,
  stories_limit,
  CASE
    WHEN stories_created_this_month >= stories_limit THEN 'LIMIT REACHED - Cannot create'
    ELSE 'Can create stories'
  END as can_create_status,
  CASE
    WHEN trial_ends_at < NOW() THEN 'TRIAL EXPIRED'
    ELSE 'Trial active'
  END as trial_status_check,
  trial_ends_at,
  NOW() as current_time
FROM users
WHERE email = 'markfaye2025@gmail.com';

-- Expected Result:
-- ✅ stories_created_this_month: 5
-- ✅ stories_limit: 5
-- ✅ can_create_status: "LIMIT REACHED - Cannot create"
-- ✅ trial_status_check: "Trial active"
-- ✅ When user clicks "Create Story", should redirect to /limit-reached
-- ✅ Message should say: "You've created 5 out of 5 free trial stories"

-- To test trial expired scenario instead, run this:
/*
UPDATE users
SET
  stories_created_this_month = 2,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() - INTERVAL '1 day'  -- Trial expired yesterday
WHERE email = 'markfaye2025@gmail.com';
*/

-- To reset back to normal trial (can create stories), run this:
/*
UPDATE users
SET
  stories_created_this_month = 0,
  stories_limit = 5,
  subscription_tier = 'trial',
  trial_status = 'active',
  trial_ends_at = NOW() + INTERVAL '7 days'
WHERE email = 'markfaye2025@gmail.com';
*/
