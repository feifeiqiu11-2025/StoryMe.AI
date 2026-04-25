-- Story bible: per-project location entities, pronoun-resolved scene character IDs,
-- and a project flag to mark stories that went through the bible enhancement path.
-- Backward compatible: existing scenes/projects keep working unchanged because every new
-- column has a safe default and legacy code paths ignore the new fields.

CREATE TABLE IF NOT EXISTS story_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reference_image_url TEXT,
  backing_character_id UUID REFERENCES character_library(id) ON DELETE SET NULL,
  first_scene_index INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_story_locations_project
  ON story_locations (project_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_story_locations_backing_character
  ON story_locations (backing_character_id) WHERE deleted_at IS NULL;

ALTER TABLE story_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_story_locations_select" ON story_locations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = story_locations.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_own_story_locations_insert" ON story_locations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = story_locations.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_own_story_locations_update" ON story_locations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = story_locations.project_id
      AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "users_own_story_locations_delete" ON story_locations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = story_locations.project_id
      AND p.user_id = auth.uid()
    )
  );

-- Scene additions: location pointer + pronoun-resolved character array + stale-prompt flag
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS location_id UUID
  REFERENCES story_locations(id) ON DELETE SET NULL;
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS resolved_character_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS prompt_stale BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_scenes_location ON scenes (location_id);

-- Project flag: marks stories that went through the story-bible enhancement path.
-- Existing stories default to FALSE and continue using the legacy image-gen path.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS uses_story_bible BOOLEAN NOT NULL DEFAULT FALSE;
