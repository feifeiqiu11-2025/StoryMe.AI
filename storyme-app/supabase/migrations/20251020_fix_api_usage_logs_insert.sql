-- ============================================
-- Fix: Allow authenticated users to INSERT their own API usage logs
-- This is needed because logApiUsage() uses regular auth client, not service role
-- ============================================

-- Allow authenticated users to insert their own usage logs
CREATE POLICY "Users can insert own usage logs"
  ON api_usage_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Add comment
COMMENT ON POLICY "Users can insert own usage logs" ON api_usage_logs IS
  'Allows authenticated users to log their own API usage for rate limiting and analytics';
