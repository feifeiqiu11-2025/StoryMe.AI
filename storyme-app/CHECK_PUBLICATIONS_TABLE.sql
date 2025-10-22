-- Check if publications table exists and show its structure
-- Run this in Supabase SQL Editor to verify the migration was applied

-- 1. Check if table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'publications'
) AS publications_table_exists;

-- 2. Show table structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'publications'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Show indexes
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'publications'
  AND schemaname = 'public';

-- 4. Show RLS policies
SELECT
  policyname,
  permissive,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'publications'
  AND schemaname = 'public';

-- 5. Show constraints
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'publications'::regclass;

-- 6. Count existing publications by platform
SELECT
  platform,
  status,
  COUNT(*) as count
FROM publications
GROUP BY platform, status
ORDER BY platform, status;
