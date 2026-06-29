-- Verify Spotify Publishing Success
-- Run this in Supabase SQL Editor

-- 1. Check the publication record
SELECT
    id,
    platform,
    status,
    title,
    audio_duration_seconds,
    file_size_bytes,
    compiled_audio_url,
    published_at,
    created_at
FROM publications
WHERE project_id = 'e0c9c4ab-3357-4f83-b32f-cc48df3bc5af'
AND platform = 'spotify';

-- Expected results:
-- status: 'published'
-- audio_duration_seconds: ~99 (1min 39s)
-- file_size_bytes: ~1583104 (1.51 MB)
-- compiled_audio_url: https://...audiobooks/.../....mp3
-- published_at: (timestamp)

-- 2. Test the compiled audio URL
-- Copy the compiled_audio_url from above and open it in browser
-- Should download/play the full audiobook (16 pages concatenated)

-- 3. Check RSS feed will include this story
SELECT
    COUNT(*) as total_published_stories
FROM publications
WHERE platform = 'spotify'
AND status IN ('published', 'live');

-- This story should be included in the RSS feed at:
-- http://localhost:3000/api/podcast/feed.xml
