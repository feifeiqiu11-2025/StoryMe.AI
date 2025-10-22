-- Migration: Clean quiz_questions table and set up new schema
-- This deletes old quiz data and sets up the correct schema for the new format

-- Step 1: Delete all existing quiz data (old format is incompatible)
DELETE FROM quiz_questions;

-- Step 2: Drop old constraint if it exists
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_correct_answer_check;

-- Step 3: Add new columns if they don't exist
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS option_a TEXT,
  ADD COLUMN IF NOT EXISTS option_b TEXT,
  ADD COLUMN IF NOT EXISTS option_c TEXT,
  ADD COLUMN IF NOT EXISTS option_d TEXT;

-- Step 4: Modify correct_answer column to be VARCHAR(1)
-- First drop NOT NULL constraint if exists
ALTER TABLE quiz_questions ALTER COLUMN correct_answer DROP NOT NULL;

-- Step 5: Add the new constraint
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_answer_check
  CHECK (correct_answer IN ('A', 'B', 'C', 'D') OR correct_answer IS NULL);

-- Step 6: Verify the schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND column_name IN ('question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer')
ORDER BY column_name;
