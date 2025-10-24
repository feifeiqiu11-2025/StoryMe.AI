-- Add Row Level Security (RLS) policies for subscription tables
-- Ensures users can only access their own subscription data

-- Enable RLS on all tables
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SUBSCRIPTIONS TABLE POLICIES
-- ============================================================================

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all subscriptions (for Stripe webhooks)
CREATE POLICY "Service role can manage all subscriptions"
  ON subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TEAMS TABLE POLICIES
-- ============================================================================

-- Primary users can view their team
CREATE POLICY "Primary users can view own team"
  ON teams
  FOR SELECT
  USING (auth.uid() = primary_user_id);

-- Team members can view their team
CREATE POLICY "Team members can view their team"
  ON teams
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
        AND team_members.user_id = auth.uid()
        AND team_members.invitation_status = 'accepted'
    )
  );

-- Primary users can update their team
CREATE POLICY "Primary users can update own team"
  ON teams
  FOR UPDATE
  USING (auth.uid() = primary_user_id);

-- Primary users can delete their team
CREATE POLICY "Primary users can delete own team"
  ON teams
  FOR DELETE
  USING (auth.uid() = primary_user_id);

-- Primary users can create teams
CREATE POLICY "Primary users can create teams"
  ON teams
  FOR INSERT
  WITH CHECK (auth.uid() = primary_user_id);

-- Service role can manage all teams
CREATE POLICY "Service role can manage all teams"
  ON teams
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- TEAM_MEMBERS TABLE POLICIES
-- ============================================================================

-- Team members can view members of their team
CREATE POLICY "Team members can view own team members"
  ON team_members
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
        AND tm.user_id = auth.uid()
        AND tm.invitation_status = 'accepted'
    )
  );

-- Primary users can manage team members
CREATE POLICY "Primary users can manage team members"
  ON team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
        AND teams.primary_user_id = auth.uid()
    )
  );

-- Users can update their own team member record (accept/decline invitation)
CREATE POLICY "Users can update own team member record"
  ON team_members
  FOR UPDATE
  USING (user_id = auth.uid());

-- Service role can manage all team members
CREATE POLICY "Service role can manage all team members"
  ON team_members
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- USAGE_TRACKING TABLE POLICIES
-- ============================================================================

-- Users can view their own usage tracking
CREATE POLICY "Users can view own usage tracking"
  ON usage_tracking
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all usage tracking
CREATE POLICY "Service role can manage all usage tracking"
  ON usage_tracking
  FOR ALL
  USING (auth.role() = 'service_role');

-- System can insert usage tracking records (via functions)
CREATE POLICY "System can insert usage tracking"
  ON usage_tracking
  FOR INSERT
  WITH CHECK (true);

-- System can update usage tracking records (via functions)
CREATE POLICY "System can update usage tracking"
  ON usage_tracking
  FOR UPDATE
  USING (true);

-- ============================================================================
-- ADDITIONAL SECURITY
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON subscriptions TO authenticated;
GRANT SELECT ON teams TO authenticated;
GRANT SELECT, UPDATE ON team_members TO authenticated;
GRANT SELECT ON usage_tracking TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON subscriptions TO service_role;
GRANT ALL ON teams TO service_role;
GRANT ALL ON team_members TO service_role;
GRANT ALL ON usage_tracking TO service_role;

-- Comment on policies
COMMENT ON POLICY "Users can view own subscription" ON subscriptions IS 'Users can only see their own subscription details';
COMMENT ON POLICY "Primary users can view own team" ON teams IS 'Team primary account can view team details';
COMMENT ON POLICY "Team members can view their team" ON teams IS 'All team members can view their team';
COMMENT ON POLICY "Users can view own usage tracking" ON usage_tracking IS 'Users can track their own usage';
