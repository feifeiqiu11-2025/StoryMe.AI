-- Fix stories_limit default for new trial users: 5 → 2
-- This ONLY affects new user INSERTs via the trigger.
-- Existing users keep their current stories_limit value.

-- Update the trigger function to use 2 instead of 5
CREATE OR REPLACE FUNCTION initialize_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trial dates: 7 days from signup (using existing columns)
  NEW.trial_started_at := COALESCE(NEW.trial_started_at, NOW());
  NEW.trial_ends_at := COALESCE(NEW.trial_ends_at, NOW() + INTERVAL '7 days');
  NEW.trial_status := COALESCE(NEW.trial_status, 'active');

  -- Set subscription fields for new users
  NEW.subscription_tier := COALESCE(NEW.subscription_tier, 'free');
  NEW.subscription_status := COALESCE(NEW.subscription_status, 'trialing');
  NEW.stories_created_this_month := COALESCE(NEW.stories_created_this_month, 0);
  NEW.stories_limit := COALESCE(NEW.stories_limit, 2);
  NEW.billing_cycle_start := COALESCE(NEW.billing_cycle_start, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the column default (for any direct INSERT that bypasses the trigger)
ALTER TABLE users ALTER COLUMN stories_limit SET DEFAULT 2;
