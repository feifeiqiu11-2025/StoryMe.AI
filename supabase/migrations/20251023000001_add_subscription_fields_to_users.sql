-- Add subscription-related fields to users table
-- Phase 2A: Subscription System Implementation
-- NOTE: Reuses existing fields from previous migrations:
--   - subscription_tier (already exists with values: 'free', 'premium')
--   - trial_started_at and trial_ends_at (from 20251019_add_trial_tracking.sql)
--   - trial_status (from 20251019_add_trial_tracking.sql)

-- Update subscription_tier constraint to include new tiers
-- Keep 'free' for backward compatibility (free users are trial users)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
ALTER TABLE users ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'trial', 'basic', 'premium', 'team'));

-- Add new subscription fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'incomplete', 'trialing'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS stories_created_this_month INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stories_limit INTEGER DEFAULT 5; -- 5 for trial/free, 20 for basic, -1 for unlimited
ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_cycle_start TIMESTAMP WITH TIME ZONE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_team_primary BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS annual_subscription BOOLEAN DEFAULT FALSE;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_team_id ON users(team_id);

-- Function to initialize trial for new users
-- Updates existing trial fields from 20251019_add_trial_tracking.sql
CREATE OR REPLACE FUNCTION initialize_user_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trial dates: 7 days from signup (using existing columns)
  NEW.trial_started_at := COALESCE(NEW.trial_started_at, NOW());
  NEW.trial_ends_at := COALESCE(NEW.trial_ends_at, NOW() + INTERVAL '7 days');
  NEW.trial_status := COALESCE(NEW.trial_status, 'active');

  -- Set subscription fields for new users
  -- Keep backward compatibility: use 'free' as default (not 'trial')
  NEW.subscription_tier := COALESCE(NEW.subscription_tier, 'free');
  NEW.subscription_status := COALESCE(NEW.subscription_status, 'trialing');
  NEW.stories_created_this_month := COALESCE(NEW.stories_created_this_month, 0);
  NEW.stories_limit := COALESCE(NEW.stories_limit, 5);
  NEW.billing_cycle_start := COALESCE(NEW.billing_cycle_start, NOW());

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-initialize trial for new users
DROP TRIGGER IF EXISTS trigger_initialize_user_trial ON users;
CREATE TRIGGER trigger_initialize_user_trial
  BEFORE INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_trial();

-- Function to reset monthly story count on billing cycle
CREATE OR REPLACE FUNCTION reset_monthly_story_count()
RETURNS void AS $$
BEGIN
  UPDATE users
  SET stories_created_this_month = 0
  WHERE billing_cycle_start IS NOT NULL
    AND billing_cycle_start + INTERVAL '1 month' <= NOW()
    AND subscription_tier IN ('basic', 'premium', 'team')
    AND subscription_status = 'active';

  -- Update billing cycle start to next month
  UPDATE users
  SET billing_cycle_start = billing_cycle_start + INTERVAL '1 month'
  WHERE billing_cycle_start IS NOT NULL
    AND billing_cycle_start + INTERVAL '1 month' <= NOW()
    AND subscription_tier IN ('basic', 'premium', 'team')
    AND subscription_status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Initialize subscription fields for existing users
-- Set defaults for users who don't have these fields yet
UPDATE users
SET
  subscription_status = COALESCE(subscription_status,
    CASE
      WHEN subscription_tier = 'premium' THEN 'active'
      WHEN trial_status = 'active' THEN 'trialing'
      ELSE 'active'
    END),
  stories_created_this_month = COALESCE(stories_created_this_month, 0),
  stories_limit = COALESCE(stories_limit,
    CASE
      WHEN subscription_tier = 'premium' THEN -1
      WHEN subscription_tier = 'free' THEN 5
      ELSE 5
    END),
  billing_cycle_start = COALESCE(billing_cycle_start,
    COALESCE(trial_started_at, created_at))
WHERE subscription_status IS NULL OR stories_limit IS NULL;

-- Comment on columns
COMMENT ON COLUMN users.subscription_tier IS 'User subscription tier: free (trial), basic, premium, team';
COMMENT ON COLUMN users.subscription_status IS 'Subscription status: active, cancelled, past_due, incomplete, trialing';
COMMENT ON COLUMN users.stories_limit IS 'Monthly story creation limit: 5 (free/trial), 20 (basic), -1 (unlimited)';
COMMENT ON COLUMN users.stories_created_this_month IS 'Number of stories created in current billing cycle';
COMMENT ON COLUMN users.team_id IS 'Links team members together (5 accounts per team)';
COMMENT ON COLUMN users.is_team_primary IS 'Primary account handles billing for team';
