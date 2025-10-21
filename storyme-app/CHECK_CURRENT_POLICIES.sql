-- Check current RLS policies on scenes and generated_images tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('scenes', 'generated_images')
ORDER BY tablename, policyname;

-- Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename IN ('scenes', 'generated_images', 'projects')
AND schemaname = 'public';

-- Check if api_usage_logs table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'api_usage_logs'
) as api_usage_logs_exists;
