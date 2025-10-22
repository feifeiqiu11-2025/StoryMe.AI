-- Migration: Add quiz_question_id to story_audio_pages table
-- This allows linking audio pages to quiz questions

-- Add quiz_question_id column if it doesn't exist
ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS quiz_question_id UUID REFERENCES quiz_questions(id) ON DELETE CASCADE;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_story_audio_pages_quiz_question_id
  ON story_audio_pages(quiz_question_id);

-- Update page_type enum to include quiz types (if using enum)
-- If page_type is text, this won't be needed
-- ALTER TYPE page_type_enum ADD VALUE IF NOT EXISTS 'quiz_transition';
-- ALTER TYPE page_type_enum ADD VALUE IF NOT EXISTS 'quiz_question';

-- Note: Since we're using VARCHAR for page_type, no enum update needed
