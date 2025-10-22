-- Migration: Make scene_id nullable in story_audio_pages
-- Quiz pages don't have a scene_id, so it needs to be nullable

-- Drop NOT NULL constraint from scene_id
ALTER TABLE story_audio_pages
  ALTER COLUMN scene_id DROP NOT NULL;

-- Verify the change
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'story_audio_pages'
  AND column_name IN ('scene_id', 'quiz_question_id', 'page_type')
ORDER BY column_name;
