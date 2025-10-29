-- Fix sync_subscription_to_user trigger to not overwrite billing_cycle_start with NULL
-- This migration fixes the issue where webhook updates with NULL current_period_start
-- would overwrite the existing billing_cycle_start value in the users table

-- Drop and recreate the trigger function with improved logic
CREATE OR REPLACE FUNCTION sync_subscription_to_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user's subscription fields when subscription changes
  UPDATE users
  SET
    subscription_tier = NEW.tier,
    subscription_status = NEW.status,
    stripe_subscription_id = NEW.stripe_subscription_id,
    stripe_customer_id = NEW.stripe_customer_id,
    -- Only update billing_cycle_start if new value is NOT NULL
    -- This prevents race conditions where webhooks send NULL dates
    billing_cycle_start = CASE
      WHEN NEW.current_period_start IS NOT NULL THEN NEW.current_period_start
      ELSE billing_cycle_start  -- Keep existing value if new value is NULL
    END,
    stories_limit = CASE
      WHEN NEW.tier = 'basic' THEN 20
      WHEN NEW.tier IN ('premium', 'team') THEN -1
      ELSE stories_limit
    END
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger is already created in 20251023000002_create_subscriptions_table.sql
-- This migration only updates the function

-- Comment explaining the fix
COMMENT ON FUNCTION sync_subscription_to_user() IS
  'Syncs subscription data to users table. Only updates billing_cycle_start if new value is NOT NULL to prevent race conditions with multiple webhooks.';
