-- Verify RLS policies for scenes table
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
