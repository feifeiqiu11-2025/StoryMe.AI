-- ============================================
-- Fix RLS Policies for Scene and Image Creation (v2)
-- Migration: Comprehensive RLS policy fix
-- ============================================

-- First, let's see what policies exist and drop ALL of them to start fresh
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies on scenes table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'scenes') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON scenes';
    END LOOP;

    -- Drop all existing policies on generated_images table
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'generated_images') LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON generated_images';
    END LOOP;
END $$;

-- ============================================
-- SCENES TABLE POLICIES
-- ============================================

-- Allow users to view their own scenes
CREATE POLICY "Users can view own scenes"
  ON scenes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to view public scenes
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

-- Allow users to INSERT scenes for their own projects
CREATE POLICY "Users can insert own scenes"
  ON scenes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to UPDATE their own scenes
CREATE POLICY "Users can update own scenes"
  ON scenes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to DELETE their own scenes
CREATE POLICY "Users can delete own scenes"
  ON scenes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = scenes.project_id
        AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- GENERATED_IMAGES TABLE POLICIES
-- ============================================

-- Allow users to view their own images
CREATE POLICY "Users can view own images"
  ON generated_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to view public images
CREATE POLICY "Users can view public images"
  ON generated_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.visibility = 'public'
        AND projects.status = 'completed'
    )
  );

-- Allow users to INSERT images for scenes in their own projects
CREATE POLICY "Users can insert own images"
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

-- Allow users to UPDATE images in their own projects
CREATE POLICY "Users can update own images"
  ON generated_images
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  );

-- Allow users to DELETE images in their own projects
CREATE POLICY "Users can delete own images"
  ON generated_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM scenes
      INNER JOIN projects ON projects.id = scenes.project_id
      WHERE scenes.id = generated_images.scene_id
        AND projects.user_id = auth.uid()
    )
  );

-- ============================================
-- VERIFY RLS IS ENABLED
-- ============================================

-- Ensure RLS is enabled on both tables
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON POLICY "Users can view own scenes" ON scenes IS
  'Allows users to view scenes from their own projects';
COMMENT ON POLICY "Users can view public scenes" ON scenes IS
  'Allows all authenticated users to view scenes from public, completed stories';
COMMENT ON POLICY "Users can insert own scenes" ON scenes IS
  'Allows users to create scenes for their own projects';
COMMENT ON POLICY "Users can update own scenes" ON scenes IS
  'Allows users to update scenes in their own projects';
COMMENT ON POLICY "Users can delete own scenes" ON scenes IS
  'Allows users to delete scenes from their own projects';
