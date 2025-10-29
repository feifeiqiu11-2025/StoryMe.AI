-- Cleanup duplicate subscription records caused by webhook race conditions
-- This script removes duplicate subscriptions created before the upsert fix was applied

-- Step 1: Delete duplicate subscription records for kindlewoodsai@gmail.com
-- Keep only the record with valid current_period_start/end dates (id: d1d96e56-1062-49d9-84ef-67cbcadb1784)
DELETE FROM subscriptions
WHERE stripe_subscription_id = 'sub_1SNdOeAg7OQqrjiWAtFXxvPs'
  AND id IN (
    '6d591231-7e67-4963-b657-42a5f47ee9d6',  -- incomplete with NULL dates
    'eb3423a7-b611-4747-9c0e-8d14ea7f722c'   -- active with NULL dates
  );

-- Step 2: Fix user's billing_cycle_start and clear trial_ends_at
-- Set billing_cycle_start from the good subscription record
UPDATE users
SET
  trial_ends_at = NULL,  -- Clear trial end date for paid user
  billing_cycle_start = '2025-10-29 17:42:56'::timestamp with time zone  -- From subscription current_period_start
WHERE id = '09ce1483-a8f6-4488-a9b5-e7dfa323efb0'
  AND email = 'kindlewoodsai@gmail.com';

-- Step 3: Verify the fix by checking for any remaining duplicates
-- This query should return 0 rows after cleanup
DO $$
DECLARE
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) - COUNT(DISTINCT stripe_subscription_id)
  INTO duplicate_count
  FROM subscriptions
  WHERE stripe_subscription_id IS NOT NULL;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Found % duplicate subscription records after cleanup', duplicate_count;
  ELSE
    RAISE NOTICE 'Cleanup successful: No duplicate subscription records found';
  END IF;
END $$;

-- Comment explaining what was fixed
COMMENT ON TABLE subscriptions IS
  'Tracks subscription details from Stripe. Fixed duplicate records caused by webhook race conditions (2025-10-29).';
