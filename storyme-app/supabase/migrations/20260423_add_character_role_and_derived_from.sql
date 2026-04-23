-- Migration: Add role + derived_from_id to character_library
-- Date: 2026-04-23
-- Description: Supports the "break into parts" feature — users extract
--              individual elements (fish, bunny, etc.) from a multi-element
--              kid's drawing into new, clean single-subject character rows.
--              The new rows link back to the source via derived_from_id;
--              role distinguishes characters from scene_elements for future
--              story-creation-time differentiation.

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

-- Role: distinguishes main characters from scene/setting assets.
-- Defaults to 'character' so existing rows remain unchanged in behavior.
ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'character';

-- Constraint: valid role values only. Separate DO block for IF NOT EXISTS compat.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'character_library_role_check'
  ) THEN
    ALTER TABLE character_library
      ADD CONSTRAINT character_library_role_check
      CHECK (role IN ('character', 'scene_element'));
  END IF;
END $$;

-- Derived-from pointer: when a character is created via breakdown, this points
-- to the source (multi-element) character it was extracted from. Null for
-- characters created through normal upload/description flows.
-- ON DELETE SET NULL: if the source is deleted, derived rows stay but lose
-- the back-pointer. Safer than CASCADE for user data.
ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS derived_from_id UUID
    REFERENCES character_library(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Partial index for looking up a source's derived children (small subset).
CREATE INDEX IF NOT EXISTS idx_character_library_derived_from
  ON character_library(derived_from_id)
  WHERE derived_from_id IS NOT NULL;
