-- Migration: Migrate quiz_questions from old schema to new schema
-- Old schema: correct_answer (text), wrong_answer_1/2/3 (text)
-- New schema: option_a/b/c/d (text), correct_answer (A/B/C/D)

-- Step 1: Add new columns if they don't exist
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS option_a TEXT,
  ADD COLUMN IF NOT EXISTS option_b TEXT,
  ADD COLUMN IF NOT EXISTS option_c TEXT,
  ADD COLUMN IF NOT EXISTS option_d TEXT;

-- Step 2: Add a temporary column to store the old correct_answer text
ALTER TABLE quiz_questions
  ADD COLUMN IF NOT EXISTS correct_answer_text TEXT;

-- Step 3: For old records, migrate the data
-- Move old correct_answer text to correct_answer_text
-- Then populate option_a/b/c/d and set correct_answer to 'A'
UPDATE quiz_questions
SET
  correct_answer_text = correct_answer,
  option_a = correct_answer,
  option_b = wrong_answer_1,
  option_c = wrong_answer_2,
  option_d = wrong_answer_3,
  correct_answer = 'A'
WHERE
  -- Only update old-style records (where correct_answer is text, not a letter)
  LENGTH(correct_answer) > 1
  AND wrong_answer_1 IS NOT NULL;

-- Step 4: Drop old constraint if exists
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_correct_answer_check;

-- Step 5: Now we can safely change correct_answer type
-- For any remaining records that somehow still have long text, set to NULL
UPDATE quiz_questions
SET correct_answer = NULL
WHERE LENGTH(correct_answer) > 1;

-- Step 6: Add the new constraint
ALTER TABLE quiz_questions
  ADD CONSTRAINT quiz_questions_correct_answer_check
  CHECK (correct_answer IN ('A', 'B', 'C', 'D') OR correct_answer IS NULL);

-- Step 7: Verify the migration
SELECT
  id,
  question_text,
  option_a,
  option_b,
  option_c,
  option_d,
  correct_answer,
  created_at
FROM quiz_questions
ORDER BY created_at DESC
LIMIT 5;
