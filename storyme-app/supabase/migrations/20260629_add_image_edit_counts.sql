-- Per-image edit limit for picture books.
--
-- Each scene image and the cover can be edited at most a fixed number of times
-- (enforced in /api/edit-image). The count is PERSISTENT — it lives with the
-- story so it survives reloads and continues across sessions/devices, and can't
-- be reset by reloading the page.
--
--   scenes.edit_count        → edits used on that scene image
--   projects.cover_edit_count → edits used on the book cover (the cover isn't a
--                               scene row, so it's tracked on the project)
--
-- Constant defaults → metadata-only change (no table rewrite); existing rows
-- backfill to 0, so every current story starts with a full edit budget. RLS is
-- already owner-scoped on both tables, so no new policies are needed. Increments
-- are done with an atomic `... AND edit_count < N` guard in the route, so the
-- cap holds even under concurrent requests.

ALTER TABLE scenes
  ADD COLUMN IF NOT EXISTS edit_count integer NOT NULL DEFAULT 0;

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS cover_edit_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN scenes.edit_count IS
  'Number of successful image edits applied to this scene (capped in /api/edit-image; failures do not count).';
COMMENT ON COLUMN projects.cover_edit_count IS
  'Number of successful image edits applied to this book cover (capped in /api/edit-image; failures do not count).';
