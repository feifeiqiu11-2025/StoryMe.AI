-- Create webhook_events table for idempotency tracking
-- Prevents processing the same Stripe webhook event multiple times

CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stripe_event_id TEXT UNIQUE NOT NULL,  -- Stripe event ID (e.g., evt_xxx)
  event_type TEXT NOT NULL,              -- Event type (e.g., customer.subscription.updated)
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  stripe_subscription_id TEXT,           -- Link to subscription if applicable
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  metadata JSONB                         -- Store full event data for debugging
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_subscription_id ON webhook_events(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed_at ON webhook_events(processed_at);

-- Auto-cleanup: Delete webhook events older than 30 days (keep database clean)
CREATE OR REPLACE FUNCTION cleanup_old_webhook_events()
RETURNS void AS $$
BEGIN
  DELETE FROM webhook_events
  WHERE processed_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE webhook_events IS 'Tracks processed Stripe webhook events for idempotency and debugging';
COMMENT ON COLUMN webhook_events.stripe_event_id IS 'Unique Stripe event ID to prevent duplicate processing';
COMMENT ON COLUMN webhook_events.metadata IS 'Full event payload for debugging and auditing';
