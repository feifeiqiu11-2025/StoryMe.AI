-- Migration: Add draft_metadata JSONB column to projects table
-- Purpose: Store UI-specific state for draft stories (characters, settings, enhanced scenes, etc.)
-- The structured data (scenes, images, project_characters) is stored in their own tables.
-- This JSONB column only holds data that doesn't map to existing DB columns.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS draft_metadata JSONB;

-- Add a comment for documentation
COMMENT ON COLUMN projects.draft_metadata IS 'Stores UI-specific draft state (characters, settings, enhanced scenes) that does not map to existing structured columns. Cleared when draft is completed.';
