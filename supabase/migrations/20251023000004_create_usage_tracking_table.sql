-- Create usage_tracking table
-- Tracks story creation usage per billing period for analytics and limits

CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  stories_created INTEGER DEFAULT 0,
  stories_limit INTEGER NOT NULL,
  last_story_created_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_billing_period ON usage_tracking(billing_period_start, billing_period_end);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, billing_period_start);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_usage_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER trigger_update_usage_tracking_updated_at
  BEFORE UPDATE ON usage_tracking
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_tracking_updated_at();

-- Function to get or create current usage tracking record
CREATE OR REPLACE FUNCTION get_or_create_usage_tracking(p_user_id UUID)
RETURNS usage_tracking AS $$
DECLARE
  v_usage_tracking usage_tracking;
  v_user_record RECORD;
BEGIN
  -- Get user's subscription details
  SELECT
    billing_cycle_start,
    stories_limit,
    subscription_tier
  INTO v_user_record
  FROM users
  WHERE id = p_user_id;

  -- Calculate billing period
  DECLARE
    v_period_start DATE := DATE(v_user_record.billing_cycle_start);
    v_period_end DATE := DATE(v_user_record.billing_cycle_start + INTERVAL '1 month');
  BEGIN
    -- Try to get existing usage tracking for current period
    SELECT * INTO v_usage_tracking
    FROM usage_tracking
    WHERE user_id = p_user_id
      AND billing_period_start = v_period_start
      AND billing_period_end = v_period_end;

    -- If not found, create new record
    IF NOT FOUND THEN
      INSERT INTO usage_tracking (
        user_id,
        billing_period_start,
        billing_period_end,
        stories_created,
        stories_limit
      ) VALUES (
        p_user_id,
        v_period_start,
        v_period_end,
        0,
        v_user_record.stories_limit
      )
      RETURNING * INTO v_usage_tracking;
    END IF;
  END;

  RETURN v_usage_tracking;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can create a story (respects limits)
CREATE OR REPLACE FUNCTION can_create_story(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_record RECORD;
  v_current_count INTEGER;
BEGIN
  -- Get user's subscription details
  SELECT
    subscription_tier,
    subscription_status,
    stories_limit,
    stories_created_this_month,
    trial_end_date
  INTO v_user_record
  FROM users
  WHERE id = p_user_id;

  -- Check subscription status
  IF v_user_record.subscription_status NOT IN ('active', 'trialing') THEN
    RETURN FALSE;
  END IF;

  -- Check if trial has expired
  IF v_user_record.subscription_tier = 'trial' AND v_user_record.trial_end_date < NOW() THEN
    RETURN FALSE;
  END IF;

  -- Unlimited tiers (Premium, Team)
  IF v_user_record.stories_limit = -1 THEN
    RETURN TRUE;
  END IF;

  -- Check if user has reached their limit
  IF v_user_record.stories_created_this_month >= v_user_record.stories_limit THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to increment story count (called when story is created)
CREATE OR REPLACE FUNCTION increment_story_count(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_usage_tracking usage_tracking;
BEGIN
  -- Get or create usage tracking record
  v_usage_tracking := get_or_create_usage_tracking(p_user_id);

  -- Increment usage tracking
  UPDATE usage_tracking
  SET
    stories_created = stories_created + 1,
    last_story_created_at = NOW()
  WHERE id = v_usage_tracking.id;

  -- Increment user's monthly count
  UPDATE users
  SET stories_created_this_month = stories_created_this_month + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Comment on table and columns
COMMENT ON TABLE usage_tracking IS 'Tracks story creation usage per billing period for analytics';
COMMENT ON COLUMN usage_tracking.billing_period_start IS 'Start date of the billing period';
COMMENT ON COLUMN usage_tracking.billing_period_end IS 'End date of the billing period';
COMMENT ON COLUMN usage_tracking.stories_created IS 'Number of stories created in this period';
COMMENT ON COLUMN usage_tracking.stories_limit IS 'Story limit for this period (snapshot)';
