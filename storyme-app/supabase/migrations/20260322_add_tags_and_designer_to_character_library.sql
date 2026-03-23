-- Migration: Add tags, designer_name, designer_age to character_library
-- Date: 2026-03-22
-- Description: Adds free-text tags array for grouping/filtering artwork by
--              workshop session, plus designer info (child artist name/age)
--              for display on the Little Artists gallery.

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

-- Tags: free-text array for grouping/filtering artwork (e.g., "SteamOji Week 1")
ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Designer info: child artist name and age (informational, shown on gallery)
ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS designer_name VARCHAR(100);

ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS designer_age INTEGER;

-- Add check constraint for designer_age (separate ALTER for IF NOT EXISTS compat)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'character_library_designer_age_check'
  ) THEN
    ALTER TABLE character_library
      ADD CONSTRAINT character_library_designer_age_check
      CHECK (designer_age IS NULL OR (designer_age >= 3 AND designer_age <= 18));
  END IF;
END $$;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- GIN index for array containment queries on public characters
-- Enables efficient: WHERE tags @> ARRAY['SteamOji Week 1'] AND is_public = TRUE
CREATE INDEX IF NOT EXISTS idx_character_library_tags
  ON character_library USING GIN (tags)
  WHERE is_public = TRUE;
