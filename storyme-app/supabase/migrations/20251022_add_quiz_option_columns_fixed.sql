-- Migration: Add option columns to quiz_questions table
-- Ensures the quiz_questions table has all required columns for saving quiz data

-- Add option columns if they don't exist
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS question TEXT,
  ADD COLUMN IF NOT EXISTS option_a TEXT,
  ADD COLUMN IF NOT EXISTS option_b TEXT,
  ADD COLUMN IF NOT EXISTS option_c TEXT,
  ADD COLUMN IF NOT EXISTS option_d TEXT,
  ADD COLUMN IF NOT EXISTS correct_answer VARCHAR(1);

-- Fix existing data: Update any lowercase letters to uppercase
UPDATE quiz_questions
SET correct_answer = UPPER(correct_answer)
WHERE correct_answer IS NOT NULL
  AND correct_answer != UPPER(correct_answer);

-- Fix existing data: Set any invalid values to NULL (will need manual fixing)
UPDATE quiz_questions
SET correct_answer = NULL
WHERE correct_answer IS NOT NULL
  AND correct_answer NOT IN ('A', 'B', 'C', 'D');

-- Now add constraint (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quiz_questions_correct_answer_check'
  ) THEN
    ALTER TABLE quiz_questions
      ADD CONSTRAINT quiz_questions_correct_answer_check
      CHECK (correct_answer IN ('A', 'B', 'C', 'D'));
  END IF;
END $$;

-- Show any rows that were fixed (for debugging)
SELECT id, project_id, question, correct_answer
FROM quiz_questions
WHERE correct_answer IS NULL;
