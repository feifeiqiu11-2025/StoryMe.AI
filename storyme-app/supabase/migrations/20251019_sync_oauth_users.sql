-- ============================================
-- Sync OAuth Users to Users Table
-- Creates user records for OAuth users who are missing from users table
-- ============================================

-- Insert missing users from auth.users to users table
-- This handles users who signed up via OAuth before we had the callback fix
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
  au.created_at,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL  -- Only insert users that don't exist in users table
  AND au.email IS NOT NULL;  -- Ensure email exists

-- Log how many users were synced
DO $$
DECLARE
  synced_count INTEGER;
BEGIN
  GET DIAGNOSTICS synced_count = ROW_COUNT;
  RAISE NOTICE 'Synced % OAuth users to users table', synced_count;
END $$;

-- Add comment for documentation
COMMENT ON TABLE users IS 'Extended user profiles with subscription and trial information. OAuth users are auto-created via auth callback or this migration.';
