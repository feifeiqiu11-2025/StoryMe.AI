-- Migration: Add quiz page types to story_audio_pages check constraint
-- The page_type column has a CHECK constraint that only allows 'cover' and 'scene'
-- We need to add 'quiz_transition' and 'quiz_question' to the allowed values

-- Drop the existing check constraint
ALTER TABLE story_audio_pages
  DROP CONSTRAINT IF EXISTS story_audio_pages_page_type_check;

-- Add new check constraint with quiz page types included
ALTER TABLE story_audio_pages
  ADD CONSTRAINT story_audio_pages_page_type_check
  CHECK (page_type IN ('cover', 'scene', 'quiz_transition', 'quiz_question'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'story_audio_pages'::regclass
  AND conname = 'story_audio_pages_page_type_check';
