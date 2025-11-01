-- Story Tags System Migration
-- Creates tables for tagging stories with predefined categories

-- ============================================
-- 1. CREATE TAGS LOOKUP TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS story_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,           -- Display name: "Bedtime Stories"
  slug VARCHAR(100) NOT NULL UNIQUE,    -- URL-friendly: "bedtime-stories"
  description TEXT,                     -- Optional description
  icon VARCHAR(50),                     -- Emoji or icon: "🌙"
  display_order INTEGER DEFAULT 0,      -- For UI ordering (lower = first)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. CREATE PROJECT-TAGS JUNCTION TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS project_tags (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES story_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (project_id, tag_id)
);

-- ============================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tags_tag_id ON project_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_story_tags_slug ON story_tags(slug);
CREATE INDEX IF NOT EXISTS idx_story_tags_display_order ON story_tags(display_order);

-- ============================================
-- 4. INSERT PREDEFINED TAGS
-- ============================================
-- Note: Avocado (AMA) is first (display_order=1) per user request
INSERT INTO story_tags (name, slug, icon, description, display_order) VALUES
  ('Avocado (AMA)', 'avocado-ama', '🥑', 'Stories from Avocado Montessori Academy', 1),
  ('Bedtime Stories', 'bedtime-stories', '🌙', 'Calm and soothing stories perfect for bedtime', 2),
  ('中文故事', 'chinese-stories', '🇨🇳', 'Stories in Chinese language', 3),
  ('Original Stories', 'original-stories', '✨', 'Stories created by children with their imagination', 4),
  ('Learning', 'learning', '📚', 'Educational stories that teach concepts', 5)
ON CONFLICT (slug) DO NOTHING; -- Skip if tags already exist

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE story_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. CREATE RLS POLICIES
-- ============================================

-- Everyone can read tags (public data)
DROP POLICY IF EXISTS "Tags are viewable by everyone" ON story_tags;
CREATE POLICY "Tags are viewable by everyone"
  ON story_tags
  FOR SELECT
  USING (true);

-- Everyone can read project_tags (needed for filtering community stories)
DROP POLICY IF EXISTS "Project tags are viewable by everyone" ON project_tags;
CREATE POLICY "Project tags are viewable by everyone"
  ON project_tags
  FOR SELECT
  USING (true);

-- Users can manage tags on their own projects
DROP POLICY IF EXISTS "Users can manage tags on own projects" ON project_tags;
CREATE POLICY "Users can manage tags on own projects"
  ON project_tags
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_tags.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. GRANT PERMISSIONS
-- ============================================
-- Grant access to authenticated users
GRANT SELECT ON story_tags TO authenticated;
GRANT SELECT ON project_tags TO authenticated;
GRANT INSERT, UPDATE, DELETE ON project_tags TO authenticated;

-- Grant access to anonymous users (for public community stories)
GRANT SELECT ON story_tags TO anon;
GRANT SELECT ON project_tags TO anon;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This migration creates:
-- 1. story_tags table with 5 predefined tags
-- 2. project_tags junction table for many-to-many relationships
-- 3. Indexes for query performance
-- 4. RLS policies for security
-- 5. Proper permissions for authenticated and anonymous users
