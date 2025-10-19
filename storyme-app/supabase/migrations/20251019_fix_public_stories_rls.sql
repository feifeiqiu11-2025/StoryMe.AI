-- ============================================
-- Fix RLS Policies for Public Stories
-- Allow all authenticated users to view public stories
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view public stories" ON projects;
DROP POLICY IF EXISTS "Users can view public scenes" ON scenes;
DROP POLICY IF EXISTS "Users can view public images" ON generated_images;

-- ============================================
-- PROJECTS TABLE POLICIES
-- ============================================

-- Policy: All authenticated users can view public projects
CREATE POLICY "Users can view public stories"
  ON projects
  FOR SELECT
  USING (
    visibility = 'public'
    AND status = 'completed'
  );

-- Existing policy for users to view their own projects (should already exist)
-- If not, uncomment and create:
-- CREATE POLICY "Users can view own projects"
--   ON projects
--   FOR SELECT
--   USING (auth.uid() = user_id);

-- ============================================
-- SCENES TABLE POLICIES
-- ============================================

-- Policy: All authenticated users can view scenes from public projects
CREATE POLICY "Users can view public scenes"
  ON scenes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.visibility = 'public'
        AND projects.status = 'completed'
    )
  );

-- Existing policy for users to view their own scenes (should already exist)
-- If not, uncomment and create:
-- CREATE POLICY "Users can view own scenes"
--   ON scenes
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM projects
--       WHERE projects.id = scenes.project_id
--         AND projects.user_id = auth.uid()
--     )
--   );

-- ============================================
-- GENERATED_IMAGES TABLE POLICIES
-- ============================================

-- Policy: All authenticated users can view images from public projects
CREATE POLICY "Users can view public images"
  ON generated_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.visibility = 'public'
        AND projects.status = 'completed'
    )
  );

-- Existing policy for users to view their own images (should already exist)
-- If not, uncomment and create:
-- CREATE POLICY "Users can view own images"
--   ON generated_images
--   FOR SELECT
--   USING (
--     EXISTS (
--       SELECT 1 FROM scenes
--       JOIN projects ON projects.id = scenes.project_id
--       WHERE scenes.id = generated_images.scene_id
--         AND projects.user_id = auth.uid()
--     )
--   );

-- ============================================
-- VERIFY RLS IS ENABLED
-- ============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON POLICY "Users can view public stories" ON projects IS
  'Allows all authenticated users to view public completed stories';

COMMENT ON POLICY "Users can view public scenes" ON scenes IS
  'Allows all authenticated users to view scenes from public completed stories';

COMMENT ON POLICY "Users can view public images" ON generated_images IS
  'Allows all authenticated users to view images from public completed stories';
