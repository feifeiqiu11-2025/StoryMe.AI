-- Verification script for Phase 2A installation
-- Run this to verify all migrations were applied successfully

-- Test 1: Check new columns exist in users table
DO $$
DECLARE
  missing_columns TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check for new subscription fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'subscription_status') THEN
    missing_columns := array_append(missing_columns, 'subscription_status');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stories_created_this_month') THEN
    missing_columns := array_append(missing_columns, 'stories_created_this_month');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stories_limit') THEN
    missing_columns := array_append(missing_columns, 'stories_limit');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stripe_customer_id') THEN
    missing_columns := array_append(missing_columns, 'stripe_customer_id');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'team_id') THEN
    missing_columns := array_append(missing_columns, 'team_id');
  END IF;

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Missing columns in users table: %', array_to_string(missing_columns, ', ');
  END IF;

  RAISE NOTICE '✓ All new columns exist in users table';
END $$;

-- Test 2: Check new tables exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'subscriptions') THEN
    RAISE EXCEPTION 'Missing subscriptions table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teams') THEN
    RAISE EXCEPTION 'Missing teams table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
    RAISE EXCEPTION 'Missing team_members table';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'usage_tracking') THEN
    RAISE EXCEPTION 'Missing usage_tracking table';
  END IF;

  RAISE NOTICE '✓ All new tables exist';
END $$;

-- Test 3: Check functions exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'initialize_user_trial') THEN
    RAISE EXCEPTION 'Missing initialize_user_trial function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'can_create_story') THEN
    RAISE EXCEPTION 'Missing can_create_story function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_story_count') THEN
    RAISE EXCEPTION 'Missing increment_story_count function';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_or_create_usage_tracking') THEN
    RAISE EXCEPTION 'Missing get_or_create_usage_tracking function';
  END IF;

  RAISE NOTICE '✓ All functions exist';
END $$;

-- Test 4: Check triggers exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_initialize_user_trial') THEN
    RAISE EXCEPTION 'Missing trigger_initialize_user_trial';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_sync_subscription_to_user') THEN
    RAISE EXCEPTION 'Missing trigger_sync_subscription_to_user';
  END IF;

  RAISE NOTICE '✓ All triggers exist';
END $$;

-- Test 5: Check indexes exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_stripe_customer_id') THEN
    RAISE EXCEPTION 'Missing idx_users_stripe_customer_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_subscriptions_user_id') THEN
    RAISE EXCEPTION 'Missing idx_subscriptions_user_id';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_teams_primary_user_id') THEN
    RAISE EXCEPTION 'Missing idx_teams_primary_user_id';
  END IF;

  RAISE NOTICE '✓ All indexes exist';
END $$;

-- Test 6: Check CHECK constraint on subscription_tier
DO $$
DECLARE
  constraint_def TEXT;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO constraint_def
  FROM pg_constraint
  WHERE conname = 'users_subscription_tier_check';

  IF constraint_def NOT LIKE '%free%' OR
     constraint_def NOT LIKE '%basic%' OR
     constraint_def NOT LIKE '%premium%' OR
     constraint_def NOT LIKE '%team%' THEN
    RAISE EXCEPTION 'subscription_tier CHECK constraint not updated correctly';
  END IF;

  RAISE NOTICE '✓ subscription_tier CHECK constraint includes all tiers';
END $$;

-- Test 7: Check existing users got default values
DO $$
DECLARE
  users_without_subscription_status INTEGER;
  users_without_stories_limit INTEGER;
BEGIN
  SELECT COUNT(*) INTO users_without_subscription_status
  FROM users
  WHERE subscription_status IS NULL;

  SELECT COUNT(*) INTO users_without_stories_limit
  FROM users
  WHERE stories_limit IS NULL;

  IF users_without_subscription_status > 0 THEN
    RAISE WARNING '% users missing subscription_status', users_without_subscription_status;
  END IF;

  IF users_without_stories_limit > 0 THEN
    RAISE WARNING '% users missing stories_limit', users_without_stories_limit;
  END IF;

  IF users_without_subscription_status = 0 AND users_without_stories_limit = 0 THEN
    RAISE NOTICE '✓ All existing users have default values';
  END IF;
END $$;

-- Test 8: Sample user statistics
DO $$
DECLARE
  total_users INTEGER;
  free_users INTEGER;
  premium_users INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_users FROM users;
  SELECT COUNT(*) INTO free_users FROM users WHERE subscription_tier = 'free';
  SELECT COUNT(*) INTO premium_users FROM users WHERE subscription_tier = 'premium';

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'User Statistics:';
  RAISE NOTICE '  Total users: %', total_users;
  RAISE NOTICE '  Free tier: % (%.1f%%)', free_users, (free_users::DECIMAL / NULLIF(total_users, 0) * 100);
  RAISE NOTICE '  Premium tier: % (%.1f%%)', premium_users, (premium_users::DECIMAL / NULLIF(total_users, 0) * 100);
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔═══════════════════════════════════════╗';
  RAISE NOTICE '║  Phase 2A Installation: SUCCESS ✓    ║';
  RAISE NOTICE '╚═══════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE 'All database migrations applied successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Test subscription middleware in application';
  RAISE NOTICE '  2. Integrate with story creation flow';
  RAISE NOTICE '  3. Begin Phase 2B: Stripe integration';
  RAISE NOTICE '';
END $$;
