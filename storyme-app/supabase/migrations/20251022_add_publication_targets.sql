-- Migration: Add publication_targets table for multi-target publishing
-- Description: Allows publishing to multiple children, subscribers, etc.
-- Date: 2025-10-22

-- Create publication_targets table
CREATE TABLE IF NOT EXISTS publication_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to parent publication
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,

  -- Target identifier (flexible for different platforms)
  target_type VARCHAR(50) NOT NULL,
  -- Examples: 'child_profile', 'user', 'subscriber', 'organization'

  target_id UUID NOT NULL,
  -- References: child_profiles.id, users.id, etc.

  -- Target-specific metadata (JSONB for flexibility)
  target_metadata JSONB DEFAULT '{}',
  -- Examples: { "category": "bedtime", "reading_level": "advanced", "favorite": true }

  -- Access control
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,

  -- Constraints
  CONSTRAINT unique_publication_target UNIQUE(publication_id, target_id)
);

-- Create indexes for performance
CREATE INDEX idx_publication_targets_publication
  ON publication_targets(publication_id);

CREATE INDEX idx_publication_targets_target
  ON publication_targets(target_type, target_id);

CREATE INDEX idx_publication_targets_active
  ON publication_targets(is_active);

CREATE INDEX idx_publication_targets_target_active
  ON publication_targets(target_id, is_active);

-- Enable Row Level Security
ALTER TABLE publication_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policy 1: Users can view targets for their publications
CREATE POLICY "Users can view their publication targets"
  ON publication_targets FOR SELECT
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 2: Children can view stories published to them
CREATE POLICY "Children can view stories published to them"
  ON publication_targets FOR SELECT
  USING (
    target_type = 'child_profile' AND
    target_id IN (
      SELECT id FROM child_profiles WHERE parent_user_id = auth.uid()
    )
  );

-- RLS Policy 3: Users can add targets to their publications
CREATE POLICY "Users can add targets to their publications"
  ON publication_targets FOR INSERT
  WITH CHECK (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 4: Users can update their publication targets
CREATE POLICY "Users can update their publication targets"
  ON publication_targets FOR UPDATE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- RLS Policy 5: Users can remove targets
CREATE POLICY "Users can remove publication targets"
  ON publication_targets FOR DELETE
  USING (
    publication_id IN (
      SELECT id FROM publications WHERE user_id = auth.uid()
    )
  );

-- Add helpful comments
COMMENT ON TABLE publication_targets IS
  'Tracks which specific users/children/audiences can access each publication';

COMMENT ON COLUMN publication_targets.target_type IS
  'Type of target: child_profile, user, organization, subscriber, etc.';

COMMENT ON COLUMN publication_targets.target_id IS
  'UUID of the target entity (child_profiles.id, users.id, etc.)';

COMMENT ON COLUMN publication_targets.target_metadata IS
  'JSON field for target-specific settings (e.g., category override, permissions)';
