-- Debug Spotify publishing for project e0c9c4ab-3357-4f83-b32f-cc48df3bc5af
-- Run this in Supabase SQL Editor

-- Step 1: Check project details
SELECT
    id,
    title,
    status,
    user_id,
    created_at
FROM projects
WHERE id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af';

-- Step 2: Check audio pages for this project
SELECT
    page_number,
    audio_url,
    CASE
        WHEN audio_url IS NULL THEN '❌ No audio'
        ELSE '✅ Has audio'
    END as status
FROM audio_pages
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af'
ORDER BY page_number;

-- Step 3: Count total vs with audio
SELECT
    COUNT(*) as total_pages,
    COUNT(audio_url) as pages_with_audio,
    COUNT(*) - COUNT(audio_url) as missing_audio
FROM audio_pages
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af';

-- Step 4: Check if publication exists
SELECT
    id,
    platform,
    status,
    error_message,
    requested_at,
    compiled_at,
    published_at
FROM publications
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af'
AND platform = 'spotify';

-- Step 5: Check recent publications (any project)
SELECT
    p.title as story_title,
    pub.platform,
    pub.status,
    pub.requested_at,
    pub.error_message
FROM publications pub
JOIN projects p ON pub.project_id = p.id
ORDER BY pub.requested_at DESC
LIMIT 10;
