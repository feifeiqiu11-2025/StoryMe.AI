-- Check audio for story e0c9c4ab-3357-4f83-b32f-cc48df3bc5af
-- Run this in Supabase SQL Editor

-- Check audio_pages table
SELECT
    page_number,
    audio_url,
    created_at
FROM audio_pages
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af'
ORDER BY page_number;

-- Count
SELECT COUNT(*) as total_audio_pages
FROM audio_pages
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af';

-- Check project details
SELECT
    id,
    title,
    status,
    created_at
FROM projects
WHERE id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af';
