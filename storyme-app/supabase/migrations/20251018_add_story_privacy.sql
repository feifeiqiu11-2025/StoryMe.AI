-- ============================================
-- Story Privacy & Public Sharing Feature
-- Migration: Add visibility and engagement tracking
-- ============================================

-- Add privacy and engagement fields to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_view_count ON projects(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_projects_published_at ON projects(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_featured ON projects(featured) WHERE featured = true;

-- Create composite index for featured public stories (most common query)
CREATE INDEX IF NOT EXISTS idx_projects_public_featured
  ON projects(visibility, featured, view_count DESC)
  WHERE visibility = 'public';

-- Add comments for documentation
COMMENT ON COLUMN projects.visibility IS 'Story privacy: private (only creator) or public (shown on landing page)';
COMMENT ON COLUMN projects.featured IS 'Admin-curated featured stories shown prominently on landing page';
COMMENT ON COLUMN projects.view_count IS 'Number of times story has been viewed (for ranking top stories)';
COMMENT ON COLUMN projects.like_count IS 'Number of likes (future feature)';
COMMENT ON COLUMN projects.share_count IS 'Number of times story has been shared on social media';
COMMENT ON COLUMN projects.published_at IS 'Timestamp when story was first made public';

-- Update existing projects to have 'private' visibility (safe default)
UPDATE projects
SET visibility = 'private'
WHERE visibility IS NULL;

-- Function to auto-update published_at when visibility changes to public
CREATE OR REPLACE FUNCTION update_published_at()
RETURNS TRIGGER AS $$
BEGIN
  -- If visibility changes from private to public, set published_at
  IF NEW.visibility = 'public' AND (OLD.visibility = 'private' OR OLD.published_at IS NULL) THEN
    NEW.published_at = NOW();
  END IF;

  -- If visibility changes back to private, keep original published_at (for history)
  -- This allows users to see "This story was public from X to Y"

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_published_at ON projects;
CREATE TRIGGER trigger_update_published_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_published_at();
