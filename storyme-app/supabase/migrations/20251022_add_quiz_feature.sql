-- Migration: Add Quiz Feature (Minimal - Reuses Existing Tables)
-- Description: Adds quiz attempts tracking and badge catalog
-- Date: 2025-10-22

-- ============================================
-- 1. Enhance existing quiz_questions table
-- ============================================

-- Add missing columns to existing quiz_questions table
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question_order INTEGER,
  ADD COLUMN IF NOT EXISTS explanation TEXT,
  ADD COLUMN IF NOT EXISTS question_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS option_a_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS option_b_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS option_c_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS option_d_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_generated BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Fix existing data: Set question_order based on creation order
-- Use row_number() to assign sequential numbers per project
WITH numbered_questions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY project_id ORDER BY id) as row_num
  FROM quiz_questions
  WHERE question_order IS NULL
)
UPDATE quiz_questions
SET question_order = numbered_questions.row_num
FROM numbered_questions
WHERE quiz_questions.id = numbered_questions.id;

-- Now add the constraint
ALTER TABLE quiz_questions
  DROP CONSTRAINT IF EXISTS unique_question_order;

ALTER TABLE quiz_questions
  ADD CONSTRAINT unique_question_order UNIQUE(project_id, question_order);

-- Update RLS policies for quiz_questions (if not already correct)
DROP POLICY IF EXISTS "Users can view quiz questions for their projects" ON quiz_questions;
DROP POLICY IF EXISTS "Users can manage quiz questions for their projects" ON quiz_questions;

CREATE POLICY "Parents can manage their story quizzes"
  ON quiz_questions
  FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can read quiz questions"
  ON quiz_questions
  FOR SELECT
  USING (true);

-- ============================================
-- 2. Create badge_catalog table (badge definitions)
-- ============================================

CREATE TABLE IF NOT EXISTS badge_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_type VARCHAR(50) UNIQUE NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  criteria JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate with default badges
INSERT INTO badge_catalog (badge_type, badge_name, badge_description, badge_icon, criteria)
VALUES
  ('story_completion', 'Story Master', 'Completed a story!', '🌟', '{"stories_completed": 1}'),
  ('quiz_completion', 'Quiz Champion', 'Finished a quiz!', '🏆', '{"quiz_completed": 1}'),
  ('first_story', 'First Adventure', 'Your very first story!', '🎉', '{"first_story": true}'),
  ('reading_streak_3', '3-Day Streak', 'Read for 3 days in a row!', '🔥', '{"streak_days": 3}'),
  ('reading_streak_7', '7-Day Streak', 'Read for a whole week!', '⭐', '{"streak_days": 7}')
ON CONFLICT (badge_type) DO NOTHING;

-- Enable RLS
ALTER TABLE badge_catalog ENABLE ROW LEVEL SECURITY;

-- Anyone can read badge definitions
CREATE POLICY "Anyone can view badge catalog"
  ON badge_catalog
  FOR SELECT
  USING (true);

-- Only admins can manage badge catalog (future feature)
CREATE POLICY "Admins can manage badge catalog"
  ON badge_catalog
  FOR ALL
  USING (auth.uid() IN (
    SELECT id FROM users WHERE email LIKE '%@kindlewood.com'
  ));

-- ============================================
-- 3. Create quiz_attempts table
-- ============================================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id UUID NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  selected_answer TEXT NOT NULL, -- The actual answer text they selected
  is_correct BOOLEAN NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_child_profile
  ON quiz_attempts(child_profile_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_project
  ON quiz_attempts(project_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_child_project
  ON quiz_attempts(child_profile_id, project_id);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_completed_at
  ON quiz_attempts(completed_at DESC);

-- Enable RLS
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Children can insert their own attempts
CREATE POLICY "Anyone can record quiz attempts"
  ON quiz_attempts
  FOR INSERT
  WITH CHECK (true);

-- Parents can view their children's attempts
CREATE POLICY "Parents can view their children's quiz attempts"
  ON quiz_attempts
  FOR SELECT
  USING (
    child_profile_id IN (
      SELECT id FROM child_profiles WHERE parent_user_id = auth.uid()
    )
  );

-- ============================================
-- 4. Update existing badges table
-- ============================================

-- Rename earned_at if it exists as a different type
-- Add reference to badge_catalog
ALTER TABLE badges
  ADD COLUMN IF NOT EXISTS badge_catalog_id UUID REFERENCES badge_catalog(id);

-- Create index for badge lookup
CREATE INDEX IF NOT EXISTS idx_badges_catalog
  ON badges(badge_catalog_id);

-- Note: Existing badges table structure is kept as-is
-- It already has: id, child_profile_id, badge_type, earned_at, metadata
-- This serves as the "child_badges" table (earned badges)

-- ============================================
-- 5. Helper function: Award badge to child
-- ============================================

CREATE OR REPLACE FUNCTION award_badge_to_child(
  p_child_profile_id UUID,
  p_badge_type VARCHAR(50),
  p_project_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_badge_catalog_id UUID;
  v_badge_id UUID;
BEGIN
  -- Get badge catalog ID
  SELECT id INTO v_badge_catalog_id
  FROM badge_catalog
  WHERE badge_type = p_badge_type
  LIMIT 1;

  IF v_badge_catalog_id IS NULL THEN
    RAISE EXCEPTION 'Badge type % not found in catalog', p_badge_type;
  END IF;

  -- Check if badge already earned for this story
  SELECT id INTO v_badge_id
  FROM badges
  WHERE child_profile_id = p_child_profile_id
    AND badge_type = p_badge_type
    AND (p_project_id IS NULL OR metadata->>'project_id' = p_project_id::text)
  LIMIT 1;

  -- If not earned, create it
  IF v_badge_id IS NULL THEN
    INSERT INTO badges (child_profile_id, badge_type, badge_catalog_id, metadata)
    VALUES (p_child_profile_id, p_badge_type, v_badge_catalog_id,
            p_metadata || jsonb_build_object('project_id', p_project_id))
    RETURNING id INTO v_badge_id;
  END IF;

  RETURN v_badge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Comments for documentation
-- ============================================

COMMENT ON TABLE badge_catalog IS 'Catalog of all available badges (definitions)';
COMMENT ON TABLE quiz_attempts IS 'Tracks every quiz answer submitted by children';
COMMENT ON COLUMN quiz_questions.question_order IS 'Order of question in quiz (1, 2, 3)';
COMMENT ON COLUMN quiz_questions.explanation IS 'Optional explanation shown after answering';
COMMENT ON COLUMN quiz_questions.question_audio_url IS 'TTS audio URL for the question text';
COMMENT ON COLUMN quiz_questions.option_a_audio_url IS 'TTS audio URL for answer option A';
COMMENT ON COLUMN quiz_questions.audio_generated IS 'TRUE if all audio has been generated for this question';
COMMENT ON COLUMN badges.badge_catalog_id IS 'Reference to badge definition in badge_catalog';
COMMENT ON FUNCTION award_badge_to_child IS 'Helper function to award badges (prevents duplicates)';
