-- Migration: Add cover_image_url to projects table
-- This stores the AI-generated cover image for the storybook

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN projects.cover_image_url IS 'URL to AI-generated cover image for the storybook PDF';
