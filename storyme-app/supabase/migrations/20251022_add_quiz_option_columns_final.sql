-- Migration: Add option columns to quiz_questions table
-- Ensures the quiz_questions table has all required columns for saving quiz data

-- Add option columns if they don't exist
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS option_a TEXT,
  ADD COLUMN IF NOT EXISTS option_b TEXT,
  ADD COLUMN IF NOT EXISTS option_c TEXT,
  ADD COLUMN IF NOT EXISTS option_d TEXT;

-- First, check if correct_answer column exists and what type it is
DO $$
BEGIN
  -- If correct_answer doesn't exist, add it as VARCHAR(1)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'quiz_questions'
    AND column_name = 'correct_answer'
  ) THEN
    ALTER TABLE quiz_questions ADD COLUMN correct_answer VARCHAR(1);
  END IF;
END $$;

-- Fix existing data: Convert numeric answers to letters
-- 1 -> A, 2 -> B, 3 -> C, 4 -> D
UPDATE quiz_questions
SET correct_answer = CASE
  WHEN correct_answer = '1' THEN 'A'
  WHEN correct_answer = '2' THEN 'B'
  WHEN correct_answer = '3' THEN 'C'
  WHEN correct_answer = '4' THEN 'D'
  WHEN correct_answer IN ('a', 'A') THEN 'A'
  WHEN correct_answer IN ('b', 'B') THEN 'B'
  WHEN correct_answer IN ('c', 'C') THEN 'C'
  WHEN correct_answer IN ('d', 'D') THEN 'D'
  ELSE correct_answer
END
WHERE correct_answer IS NOT NULL;

-- Drop the old constraint if it exists
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_correct_answer_check;

-- Add the new constraint
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_answer_check
  CHECK (correct_answer IN ('A', 'B', 'C', 'D') OR correct_answer IS NULL);

-- Show the updated data for verification
SELECT id, question, correct_answer, option_a, option_b, option_c, option_d
FROM quiz_questions
ORDER BY created_at DESC
LIMIT 5;
