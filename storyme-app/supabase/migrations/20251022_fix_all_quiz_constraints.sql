-- Migration: Fix ALL NOT NULL constraints in quiz_questions table
-- The old schema has many NOT NULL columns that the new schema doesn't use

-- Step 1: First, let's see what columns have NOT NULL constraints
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND is_nullable = 'NO'
ORDER BY column_name;

-- Step 2: Drop NOT NULL constraints from all old schema columns
ALTER TABLE quiz_questions
  ALTER COLUMN question_text DROP NOT NULL,
  ALTER COLUMN wrong_answer_1 DROP NOT NULL,
  ALTER COLUMN wrong_answer_2 DROP NOT NULL,
  ALTER COLUMN wrong_answer_3 DROP NOT NULL;

-- Step 3: Also drop NOT NULL from any other columns that might have it
-- (Running these will fail silently if column doesn't have NOT NULL, which is fine)
ALTER TABLE quiz_questions ALTER COLUMN difficulty_level DROP NOT NULL;
ALTER TABLE quiz_questions ALTER COLUMN question_type DROP NOT NULL;

-- Step 4: Create trigger to sync old columns from new columns (for backward compatibility)
CREATE OR REPLACE FUNCTION sync_quiz_question_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync question <-> question_text
  IF NEW.question IS NOT NULL AND NEW.question_text IS NULL THEN
    NEW.question_text := NEW.question;
  END IF;
  IF NEW.question_text IS NOT NULL AND NEW.question IS NULL THEN
    NEW.question := NEW.question_text;
  END IF;

  -- Sync options to wrong_answers (option_a is correct, b/c/d are wrong)
  IF NEW.option_b IS NOT NULL AND NEW.wrong_answer_1 IS NULL THEN
    NEW.wrong_answer_1 := NEW.option_b;
  END IF;
  IF NEW.option_c IS NOT NULL AND NEW.wrong_answer_2 IS NULL THEN
    NEW.wrong_answer_2 := NEW.option_c;
  END IF;
  IF NEW.option_d IS NOT NULL AND NEW.wrong_answer_3 IS NULL THEN
    NEW.wrong_answer_3 := NEW.option_d;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create/replace trigger
DROP TRIGGER IF EXISTS sync_quiz_columns_trigger ON quiz_questions;
CREATE TRIGGER sync_quiz_columns_trigger
  BEFORE INSERT OR UPDATE ON quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION sync_quiz_question_columns();

-- Step 5: Verify - should show NO as 'NO' only for id and project_id
SELECT column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
ORDER BY column_name;
