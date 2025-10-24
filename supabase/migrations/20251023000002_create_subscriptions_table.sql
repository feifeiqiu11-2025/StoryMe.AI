-- Create subscriptions table
-- Tracks subscription details from Stripe

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'premium', 'team')),
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'past_due', 'incomplete', 'trialing', 'unpaid')),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trigger_update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_subscriptions_updated_at();

-- Function to sync subscription changes to users table
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
    billing_cycle_start = NEW.current_period_start,
    stories_limit = CASE
      WHEN NEW.tier = 'basic' THEN 20
      WHEN NEW.tier IN ('premium', 'team') THEN -1
      ELSE stories_limit
    END
  WHERE id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync subscription data to users table
DROP TRIGGER IF EXISTS trigger_sync_subscription_to_user ON subscriptions;
CREATE TRIGGER trigger_sync_subscription_to_user
  AFTER INSERT OR UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION sync_subscription_to_user();

-- Comment on table and columns
COMMENT ON TABLE subscriptions IS 'Stores subscription details synced from Stripe';
COMMENT ON COLUMN subscriptions.tier IS 'Subscription tier: basic, premium, team';
COMMENT ON COLUMN subscriptions.status IS 'Stripe subscription status';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If true, subscription will be cancelled at period end';
