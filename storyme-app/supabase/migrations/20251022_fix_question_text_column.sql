-- Migration: Fix question_text column issue
-- The table has question_text (NOT NULL) but we're using question column

-- Option 1: Make question_text nullable
ALTER TABLE quiz_questions ALTER COLUMN question_text DROP NOT NULL;

-- Option 2 (alternative): Copy question to question_text on insert
-- We'll use a trigger for this

-- Create or replace trigger to sync question -> question_text
CREATE OR REPLACE FUNCTION sync_question_text()
RETURNS TRIGGER AS $$
BEGIN
  -- If question is provided but question_text is not, copy it
  IF NEW.question IS NOT NULL AND NEW.question_text IS NULL THEN
    NEW.question_text := NEW.question;
  END IF;

  -- If question_text is provided but question is not, copy it
  IF NEW.question_text IS NOT NULL AND NEW.question IS NULL THEN
    NEW.question := NEW.question_text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS sync_question_text_trigger ON quiz_questions;
CREATE TRIGGER sync_question_text_trigger
  BEFORE INSERT OR UPDATE ON quiz_questions
  FOR EACH ROW
  EXECUTE FUNCTION sync_question_text();

-- Verify
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'quiz_questions'
  AND column_name IN ('question', 'question_text')
ORDER BY column_name;
