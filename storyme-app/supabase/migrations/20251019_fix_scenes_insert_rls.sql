-- ============================================
-- Fix RLS Policies for Scene Creation
-- Migration: Allow users to create/update scenes for their own projects
-- ============================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert scenes for own projects" ON scenes;
DROP POLICY IF EXISTS "Users can update scenes for own projects" ON scenes;
DROP POLICY IF EXISTS "Users can insert images for own scenes" ON generated_images;
DROP POLICY IF EXISTS "Users can update images for own scenes" ON generated_images;

-- Allow users to INSERT scenes for their own projects
CREATE POLICY "Users can insert scenes for own projects"
  ON scenes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to UPDATE scenes for their own projects
CREATE POLICY "Users can update scenes for own projects"
  ON scenes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to INSERT generated images for scenes in their own projects
CREATE POLICY "Users can insert images for own scenes"
  ON generated_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to UPDATE generated images for scenes in their own projects
CREATE POLICY "Users can update images for own scenes"
  ON generated_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON POLICY "Users can insert scenes for own projects" ON scenes IS
  'Allows authenticated users to create scenes for projects they own';
COMMENT ON POLICY "Users can update scenes for own projects" ON scenes IS
  'Allows authenticated users to update scenes for projects they own';
COMMENT ON POLICY "Users can insert images for own scenes" ON generated_images IS
  'Allows authenticated users to create images for scenes in projects they own';
COMMENT ON POLICY "Users can update images for own scenes" ON generated_images IS
  'Allows authenticated users to update images for scenes in projects they own';
