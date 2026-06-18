-- My Art "Recent drawings" gallery for chapter books (Phase 1).
--
-- Chapter books are rows in `projects` (project_type='chapter_book'); their
-- editable drawings are scoped to the book, so the gallery lives on the row
-- — no separate table. This column holds a LIGHTWEIGHT INDEX only (max 10):
--   [{ id, pngUrl, strokesUrl, w, h, v, createdAt }]
-- The heavy stroke data is stored as JSON files in Supabase Storage
-- (strokesUrl), so `select('*')` on the hot book-load / autosave paths stays
-- cheap. A new chapter book starts with [] → an empty gallery.
--
-- Constant default → metadata-only change (no table rewrite). RLS is already
-- enforced on `projects` (owner-only), so no new policies are needed.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS art_drawings jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN projects.art_drawings IS
  'Chapter-book My Art gallery: lightweight index of up to 10 recent drawings {id, pngUrl, strokesUrl, w, h, v, createdAt}. Heavy stroke data lives in Supabase Storage (strokesUrl).';
