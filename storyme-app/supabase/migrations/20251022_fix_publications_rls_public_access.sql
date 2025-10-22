-- Migration: Allow public access to published podcast episodes
-- Description: RSS feeds need to be publicly accessible for Spotify to poll
-- Date: 2025-10-22

-- Add RLS policy for public read access to published/live publications
-- This allows the RSS feed endpoint to read episodes without authentication
CREATE POLICY "Public can view published podcast episodes"
  ON publications FOR SELECT
  USING (
    status IN ('published', 'live') AND
    platform = 'spotify'
  );

-- Add helpful comment
COMMENT ON POLICY "Public can view published podcast episodes" ON publications IS
  'Allows RSS feed endpoint and Spotify to read published episodes without authentication';
