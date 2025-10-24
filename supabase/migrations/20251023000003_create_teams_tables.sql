-- Create teams and team_members tables
-- Supports Team tier: 5 separate accounts bundled together

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  primary_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_name TEXT,
  member_count INTEGER DEFAULT 1,
  max_members INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  invited_email TEXT,
  invitation_status TEXT DEFAULT 'pending' CHECK (invitation_status IN ('pending', 'accepted', 'declined', 'expired')),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_teams_primary_user_id ON teams(primary_user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_invited_email ON team_members(invited_email);

-- Function to update teams updated_at timestamp
CREATE OR REPLACE FUNCTION update_teams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update teams updated_at
DROP TRIGGER IF EXISTS trigger_update_teams_updated_at ON teams;
CREATE TRIGGER trigger_update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_teams_updated_at();

-- Function to update team member count
CREATE OR REPLACE FUNCTION update_team_member_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Update team member count when a member joins or leaves
  IF TG_OP = 'INSERT' AND NEW.invitation_status = 'accepted' THEN
    UPDATE teams
    SET member_count = member_count + 1
    WHERE id = NEW.team_id;
  ELSIF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND OLD.invitation_status = 'accepted' AND NEW.invitation_status != 'accepted') THEN
    UPDATE teams
    SET member_count = member_count - 1
    WHERE id = COALESCE(NEW.team_id, OLD.team_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update team member count
DROP TRIGGER IF EXISTS trigger_update_team_member_count ON team_members;
CREATE TRIGGER trigger_update_team_member_count
  AFTER INSERT OR UPDATE OR DELETE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION update_team_member_count();

-- Function to sync team_id to users table when member accepts invitation
CREATE OR REPLACE FUNCTION sync_team_member_to_user()
RETURNS TRIGGER AS $$
BEGIN
  -- When a team member accepts invitation, update their user record
  IF NEW.invitation_status = 'accepted' AND NEW.user_id IS NOT NULL THEN
    UPDATE users
    SET
      team_id = NEW.team_id,
      is_team_primary = NEW.is_primary,
      subscription_tier = 'team',
      subscription_status = 'active',
      stories_limit = -1  -- Unlimited for team members
    WHERE id = NEW.user_id;

    -- Set joined_at timestamp
    NEW.joined_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to sync team member acceptance to users table
DROP TRIGGER IF EXISTS trigger_sync_team_member_to_user ON team_members;
CREATE TRIGGER trigger_sync_team_member_to_user
  BEFORE INSERT OR UPDATE ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION sync_team_member_to_user();

-- Function to enforce max team members
CREATE OR REPLACE FUNCTION enforce_max_team_members()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
BEGIN
  -- Get current member count and max allowed for this team
  SELECT member_count, max_members INTO current_count, max_allowed
  FROM teams
  WHERE id = NEW.team_id;

  -- Check if adding this member would exceed the limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Team has reached maximum member limit of %', max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce max team members before invitation
DROP TRIGGER IF EXISTS trigger_enforce_max_team_members ON team_members;
CREATE TRIGGER trigger_enforce_max_team_members
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION enforce_max_team_members();

-- Comment on tables and columns
COMMENT ON TABLE teams IS 'Teams for Team tier subscription (5 accounts bundled)';
COMMENT ON TABLE team_members IS 'Individual members of teams';
COMMENT ON COLUMN teams.primary_user_id IS 'Primary account that handles billing';
COMMENT ON COLUMN teams.max_members IS 'Maximum team size (default 5)';
COMMENT ON COLUMN team_members.is_primary IS 'True for the billing account owner';
COMMENT ON COLUMN team_members.invitation_status IS 'Status of team invitation';
