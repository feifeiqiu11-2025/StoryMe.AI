-- Migration: Generic Publications System for Multi-Platform Publishing
-- Description: Scalable system for publishing to Spotify, KindleWood Kids App, Apple Podcasts, etc.
-- Date: 2025-10-21

-- Create publications table (generic for all platforms)
CREATE TABLE IF NOT EXISTS publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Platform identifier
  platform VARCHAR(50) NOT NULL, -- 'spotify', 'kindlewood_app', 'apple_podcasts', etc.

  -- Compiled audio/content
  compiled_audio_url TEXT, -- Public URL to compiled MP3/audio file
  audio_duration_seconds INTEGER,
  file_size_bytes BIGINT,

  -- Metadata (generic across platforms)
  title TEXT NOT NULL,
  author TEXT NOT NULL, -- e.g., "Emma (age 7)"
  description TEXT,
  cover_image_url TEXT,

  -- Unique identifier per platform
  external_id VARCHAR(255), -- Platform-specific ID (e.g., Spotify episode ID, App Store ID)
  external_url TEXT, -- Public URL on the platform
  guid VARCHAR(255) NOT NULL, -- Global unique ID: "{platform}-{projectId}"

  -- Publishing status
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- pending: Queued for publishing
    -- compiling: Audio/content compilation in progress
    -- ready: Compiled and ready to publish
    -- publishing: Being published to platform
    -- published: Published, waiting for platform to go live
    -- live: Live on platform
    -- failed: Publishing failed
    -- unpublished: User unpublished from platform

  -- Platform-specific metadata (JSON for flexibility)
  platform_metadata JSONB DEFAULT '{}', -- Store platform-specific data

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  compiled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  live_at TIMESTAMPTZ,
  unpublished_at TIMESTAMPTZ,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Constraints
  CONSTRAINT unique_project_platform UNIQUE(project_id, platform)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_publications_user_id ON publications(user_id);
CREATE INDEX IF NOT EXISTS idx_publications_platform ON publications(platform);
CREATE INDEX IF NOT EXISTS idx_publications_status ON publications(status);
CREATE INDEX IF NOT EXISTS idx_publications_published_at ON publications(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_publications_guid ON publications(guid);
CREATE INDEX IF NOT EXISTS idx_publications_project_platform ON publications(project_id, platform);

-- Enable Row Level Security
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own publications
CREATE POLICY "Users can view their own publications"
  ON publications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create publications for their own projects
CREATE POLICY "Users can create publications for their projects"
  ON publications FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Users can update their own publications
CREATE POLICY "Users can update their own publications"
  ON publications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own publications (unpublish)
CREATE POLICY "Users can delete their own publications"
  ON publications FOR DELETE
  USING (auth.uid() = user_id);

-- Add helpful comments
COMMENT ON TABLE publications IS 'Generic multi-platform publishing system for stories (Spotify, KindleWood Kids App, Apple Podcasts, etc.)';
COMMENT ON COLUMN publications.platform IS 'Platform identifier: spotify, kindlewood_app, apple_podcasts, youtube, etc.';
COMMENT ON COLUMN publications.platform_metadata IS 'JSON field for platform-specific data (e.g., Spotify show ID, App version, etc.)';
COMMENT ON COLUMN publications.guid IS 'Global unique identifier format: {platform}-story-{projectId}';

-- Create function to get publication stats by platform
CREATE OR REPLACE FUNCTION get_publication_stats()
RETURNS TABLE (
  platform VARCHAR(50),
  total_published BIGINT,
  live_count BIGINT,
  failed_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.platform,
    COUNT(*) as total_published,
    COUNT(*) FILTER (WHERE p.status = 'live') as live_count,
    COUNT(*) FILTER (WHERE p.status = 'failed') as failed_count
  FROM publications p
  GROUP BY p.platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
