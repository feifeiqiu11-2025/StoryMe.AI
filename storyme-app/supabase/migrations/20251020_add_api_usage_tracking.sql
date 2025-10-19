-- ============================================
-- API Usage Tracking & Rate Limiting
-- Migration: Track API usage for analytics and rate limiting
-- ============================================

-- Create API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User tracking
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_guest BOOLEAN DEFAULT false,
  guest_session_id VARCHAR(255),

  -- API details
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,

  -- Request metadata
  request_id VARCHAR(100) UNIQUE,
  ip_address INET,
  user_agent TEXT,

  -- Response metadata
  status_code INTEGER,
  response_time_ms INTEGER,
  error_message TEXT,

  -- Resource usage (for cost tracking)
  images_generated INTEGER DEFAULT 0,
  scenes_enhanced INTEGER DEFAULT 0,
  characters_created INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_endpoint ON api_usage_logs(user_id, endpoint, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_guest_session ON api_usage_logs(guest_session_id, created_at DESC) WHERE guest_session_id IS NOT NULL;

-- Enable RLS
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
  ON api_usage_logs
  FOR SELECT
  USING (user_id = auth.uid());

-- Service role can insert logs (no user-facing INSERT policy needed)
-- Logs are written by backend using service role client

-- Add comments for documentation
COMMENT ON TABLE api_usage_logs IS
  'Tracks all API usage for analytics, rate limiting, and cost monitoring';

COMMENT ON COLUMN api_usage_logs.user_id IS
  'Reference to authenticated user, NULL for guest users';

COMMENT ON COLUMN api_usage_logs.guest_session_id IS
  'Session ID for guest users (from cookie), NULL for authenticated users';

COMMENT ON COLUMN api_usage_logs.images_generated IS
  'Number of images generated in this API call (for cost tracking)';

COMMENT ON COLUMN api_usage_logs.response_time_ms IS
  'Response time in milliseconds (for performance monitoring)';

-- ============================================
-- Helper Functions for Rate Limiting
-- ============================================

-- Function to get daily image count for a user
CREATE OR REPLACE FUNCTION get_daily_image_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(images_generated), 0)
    FROM api_usage_logs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '24 hours'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get hourly image count for a user
CREATE OR REPLACE FUNCTION get_hourly_image_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COALESCE(SUM(images_generated), 0)
    FROM api_usage_logs
    WHERE user_id = p_user_id
      AND created_at >= NOW() - INTERVAL '1 hour'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has hit daily limit
CREATE OR REPLACE FUNCTION check_daily_image_limit(p_user_id UUID, p_daily_limit INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_daily_image_count(p_user_id) < p_daily_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has hit hourly limit (burst protection)
CREATE OR REPLACE FUNCTION check_hourly_image_limit(p_user_id UUID, p_hourly_limit INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN get_hourly_image_count(p_user_id) < p_hourly_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_daily_image_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_hourly_image_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_daily_image_limit(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION check_hourly_image_limit(UUID, INTEGER) TO authenticated;
