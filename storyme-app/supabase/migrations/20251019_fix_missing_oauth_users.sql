-- ============================================
-- Fix Missing OAuth Users
-- Syncs auth.users to users table for any missing users
-- This fixes the issue where OAuth users couldn't save characters
-- ============================================

-- Insert any missing users from auth.users to users table
INSERT INTO users (
  id,
  email,
  name,
  subscription_tier,
  trial_started_at,
  trial_ends_at,
  images_generated_count,
  images_limit,
  trial_status,
  privacy_consent_given,
  created_at,
  updated_at
)
SELECT
  au.id,
  au.email,
  -- Extract name from user metadata or use email prefix
  COALESCE(
    au.raw_user_meta_data->>'name',
    au.raw_user_meta_data->>'full_name',
    SPLIT_PART(au.email, '@', 1)
  ) as name,
  'free' as subscription_tier,
  -- Use their auth creation date as trial start
  au.created_at as trial_started_at,
  -- Set trial end to 7 days from their creation
  au.created_at + INTERVAL '7 days' as trial_ends_at,
  0 as images_generated_count,
  50 as images_limit,
  -- Check if trial has expired
  CASE
    WHEN au.created_at + INTERVAL '7 days' > NOW() THEN 'active'
    ELSE 'expired'
  END as trial_status,
  false as privacy_consent_given, -- Default to false, they'll need to consent
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL  -- Only insert users that don't exist in users table
  AND au.email IS NOT NULL  -- Ensure email exists
ON CONFLICT (id) DO NOTHING;  -- Skip if somehow already exists

-- Log how many users were synced
DO $$
DECLARE
  synced_count INTEGER;
BEGIN
  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RAISE NOTICE '✅ Synced % missing OAuth users to users table', synced_count;
END $$;
