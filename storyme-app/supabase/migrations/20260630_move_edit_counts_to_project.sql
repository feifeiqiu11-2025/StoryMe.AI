-- Move the per-image edit cap onto the PROJECT row so it survives the save flow.
--
-- saveDraft and saveCompletedStory both DELETE + re-INSERT scene rows on every save
-- (clean recreate), which resets scenes.edit_count back to its default. The project
-- row, by contrast, persists across saves — which is why the cover count (already on
-- the project) survived. So we store ALL per-image edit counts on the project, in one
-- JSONB keyed by sceneNumber as text: "0" = cover, "1".."N" = scenes. This is the same
-- sceneNumber keying the route/UI already use, and it's bullet-proof against scene-row
-- recreation (save, regenerate-all, etc.).
--
-- Replaces scenes.edit_count + projects.cover_edit_count (left in place, now unused).
-- Constant default → metadata-only change; existing rows backfill to '{}'. RLS is
-- already owner-scoped on projects, so no new policies are needed.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS edit_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Carry over any existing cover edit counts to key "0" so they aren't lost.
UPDATE projects
  SET edit_counts = edit_counts || jsonb_build_object('0', cover_edit_count)
  WHERE cover_edit_count > 0;

COMMENT ON COLUMN projects.edit_counts IS
  'Per-image edit counts for the edit cap, keyed by sceneNumber as text ("0"=cover, "1".."N"=scenes). On the project row so it survives the save flow''s scene delete+recreate. Capped in /api/edit-image; failures do not count.';
