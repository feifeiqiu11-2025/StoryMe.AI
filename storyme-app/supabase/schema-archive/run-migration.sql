-- Migration: Make scene_id nullable in story_audio_pages
-- This allows quiz pages to be inserted without a scene_id

ALTER TABLE story_audio_pages 
  ALTER COLUMN scene_id DROP NOT NULL;

-- Verify the change
SELECT 
  column_name, 
  is_nullable, 
  data_type
FROM information_schema.columns
WHERE table_name = 'story_audio_pages'
  AND column_name IN ('scene_id', 'quiz_question_id', 'page_type')
ORDER BY column_name;
