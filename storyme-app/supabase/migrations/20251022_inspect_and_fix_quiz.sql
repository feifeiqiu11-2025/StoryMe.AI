-- First, let's see what data exists
SELECT id, question, correct_answer,
       LENGTH(correct_answer) as answer_length,
       ASCII(correct_answer) as ascii_code
FROM quiz_questions
WHERE correct_answer IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- Check distinct values
SELECT DISTINCT correct_answer, COUNT(*)
FROM quiz_questions
WHERE correct_answer IS NOT NULL
GROUP BY correct_answer;
