-- Migration: Fix RLS to allow anonymous access to published episodes
-- Description: The previous policy might not work for anon role, being more explicit
-- Date: 2025-10-22

-- Drop the previous policy if it exists
DROP POLICY IF EXISTS "Public can view published podcast episodes" ON publications;

-- Create policy that explicitly works for both authenticated and anonymous users
CREATE POLICY "Anyone can view published podcast episodes"
  ON publications FOR SELECT
  TO public  -- Explicitly allow both authenticated and anon
  USING (
    status IN ('published', 'live') AND
    platform = 'spotify'
  );

-- Verify anon role has SELECT permission on the table
GRANT SELECT ON publications TO anon;
GRANT SELECT ON publications TO authenticated;

-- Add helpful comment
COMMENT ON POLICY "Anyone can view published podcast episodes" ON publications IS
  'Allows RSS feed endpoint (anon role) and Spotify to read published episodes';
