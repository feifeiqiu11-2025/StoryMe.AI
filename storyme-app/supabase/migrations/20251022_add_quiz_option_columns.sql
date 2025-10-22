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

-- Add constraint to ensure correct_answer is A, B, C, or D
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
