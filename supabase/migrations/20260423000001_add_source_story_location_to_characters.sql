-- Save-to-library provenance: when a user promotes an auto-detected story_locations
-- entry to their reusable character library, this column records which location
-- it was derived from. NULL for all existing characters (added by the user manually).
-- ON DELETE SET NULL so deleting the source story later does not destroy the library entry.

ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS source_story_location_id UUID
    REFERENCES story_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_character_library_source_story_location
  ON character_library (source_story_location_id)
  WHERE source_story_location_id IS NOT NULL;
