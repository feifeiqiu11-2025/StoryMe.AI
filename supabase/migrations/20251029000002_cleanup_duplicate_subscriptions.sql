-- Cleanup duplicate subscription records caused by webhook race conditions
-- This script removes duplicate subscriptions created before the upsert fix was applied

-- Step 1a: Delete duplicate subscription records for kindlewoodsai@gmail.com
-- Keep only the record with valid current_period_start/end dates (id: d1d96e56-1062-49d9-84ef-67cbcadb1784)
DELETE FROM subscriptions
WHERE stripe_subscription_id = 'sub_1SNdOeAg7OQqrjiWAtFXxvPs'
  AND id IN (
    '6d591231-7e67-4963-b657-42a5f47ee9d6',  -- incomplete with NULL dates
    'eb3423a7-b611-4747-9c0e-8d14ea7f722c'   -- active with NULL dates
  );

-- Step 1b: Delete duplicate subscription records for xshephy@gmail.com
-- Keep only the record with valid current_period_start/end dates (id: df2a5dda-b16b-411f-bc92-a82cbbe0d253)
DELETE FROM subscriptions
WHERE stripe_subscription_id = 'sub_1SMaJeAg7OQqrjiWRHYOGttn'
  AND id IN (
    'f62e5dc1-7882-403c-87ac-b608305db9d8',  -- active with NULL dates
    '97b78c1a-a923-4190-9773-08b79fc329ee'   -- incomplete with NULL dates
  );

-- Step 1c: Delete duplicate subscription records for feifeiqiu11@gmail.com
-- Keep only the record with valid current_period_start/end dates (id: 9ca9b0cd-c858-4337-b8c4-7f74d9b4bce9)
-- Note: User has 4 duplicates including an upgrade to premium with NULL dates
DELETE FROM subscriptions
WHERE stripe_subscription_id = 'sub_1SMbSIAg7OQqrjiWoqZM4IxI'
  AND id IN (
    'f63c6063-14e4-4afc-94b9-f27c0a51d292',  -- basic, active with NULL dates
    '8118c671-421c-408b-b1de-7d16a2c918bb',  -- basic, incomplete with NULL dates
    '674337f9-3fd6-4bf1-91bd-ae82e92c1faf'   -- premium, active with NULL dates (latest but bad)
  );

-- Step 2a: Fix kindlewoodsai@gmail.com user data
-- Keep trial_ends_at for historical records - UI now checks trial_status to determine if trial is active
UPDATE users
SET
  billing_cycle_start = '2025-10-29 17:42:56'::timestamp with time zone  -- From subscription current_period_start
WHERE id = '09ce1483-a8f6-4488-a9b5-e7dfa323efb0'
  AND email = 'kindlewoodsai@gmail.com';

-- Step 2b: Fix xshephy@gmail.com user data
UPDATE users
SET
  billing_cycle_start = '2025-10-26 20:13:26'::timestamp with time zone,  -- From subscription current_period_start
  subscription_status = 'active'  -- Fix status from 'incomplete' to 'active'
WHERE id = 'f75e26b7-4177-4c2a-b3eb-55c5d6055b54'
  AND email = 'xshephy@gmail.com';

-- Step 2c: Fix feifeiqiu11@gmail.com user data
-- Note: User upgraded from basic to premium but last webhook had NULL dates
-- Keeping the basic tier record (9ca9b0cd) which has valid dates (2025-10-26 21:26:26)
-- TODO: Verify in Stripe if user should be premium or basic, and update subscription_tier if needed
UPDATE users
SET
  billing_cycle_start = '2025-10-26 21:26:26'::timestamp with time zone  -- From the good basic subscription record
  -- subscription_tier may need to be updated to 'premium' after Stripe verification
WHERE id = (SELECT id FROM users WHERE email = 'feifeiqiu11@gmail.com');

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
