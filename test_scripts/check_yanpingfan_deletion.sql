-- Check if yanpingfan2024@gmail.com still exists in database
-- This verifies if account deletion worked

-- Check users table
SELECT
  id,
  email,
  name,
  subscription_tier,
  created_at
FROM users
WHERE email = 'yanpingfan2024@gmail.com';

-- Check if any projects still exist
SELECT
  id,
  user_id,
  title,
  status,
  created_at
FROM projects
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'yanpingfan2024@gmail.com'
);

-- Check if any characters still exist
SELECT
  id,
  user_id,
  name,
  created_at
FROM character_library
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'yanpingfan2024@gmail.com'
);

-- Check subscriptions
SELECT
  id,
  user_id,
  tier,
  status,
  stripe_subscription_id
FROM subscriptions
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'yanpingfan2024@gmail.com'
);

-- Check auth.users (requires admin access)
SELECT
  id,
  email,
  created_at,
  deleted_at
FROM auth.users
WHERE email = 'yanpingfan2024@gmail.com';
