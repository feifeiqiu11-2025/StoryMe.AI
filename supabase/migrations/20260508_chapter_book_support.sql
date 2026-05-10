-- Chapter book support — Phase 1 foundation.
-- Older kids (ages 7–12) write text-heavy chapter books inside a Tiptap
-- editor; the doc JSON lives in projects.canvas_state, narration reuses
-- story_audio_pages, and cover/visibility/share/favorite all reuse the
-- existing projects columns.
--
-- Companion code:
--   - storyme-app/src/lib/services/chapterBook.service.ts
--   - storyme-app/src/app/api/v1/chapter-books/route.ts
--   - storyme-app/src/app/api/v1/chapter-books/[id]/route.ts
--   - storyme-app/src/app/(dashboard)/chapter-books/new/page.tsx
--   - storyme-app/src/app/(dashboard)/chapter-books/[id]/edit/page.tsx
--   - storyme-app/src/app/(dashboard)/chapter-books/[id]/read/page.tsx
--
-- All deltas are additive — picture_book projects are unaffected.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Project type discriminator
-- ─────────────────────────────────────────────────────────────────────────
-- Existing rows default to 'picture_book' so every list query keeps working
-- without changes. New chapter-book projects set 'chapter_book' explicitly.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type VARCHAR(20)
  NOT NULL DEFAULT 'picture_book';

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_type_check
  CHECK (project_type IN ('picture_book', 'chapter_book'));

COMMENT ON COLUMN projects.project_type IS
  'Discriminator for project flavor. picture_book = scene-based illustrated story; '
  'chapter_book = Tiptap document stored in canvas_state. Future flavors widen the CHECK.';

-- Composite index for dashboard "Your stories" listings filtered by type.
CREATE INDEX IF NOT EXISTS idx_projects_user_type
  ON projects(user_id, project_type);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. canvas_state column for Tiptap document JSON
-- ─────────────────────────────────────────────────────────────────────────
-- An earlier migration (20260417_add_canvas_state.sql) introduced this column
-- for an unshipped canvas-editor POC. Since that migration may not have run
-- on every environment, add the column defensively here. Existing rows
-- (if any) hold the abandoned POC payload, which chapter-book code never
-- reads — picture_book rows simply leave it NULL.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS canvas_state JSONB;

COMMENT ON COLUMN projects.canvas_state IS
  'Editor document JSON. For chapter_book projects, stores the Tiptap '
  'ProseMirror doc (auto-saved on edit). NULL or unused for picture_book.';

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Allow page-level audio rows for chapter books
-- ─────────────────────────────────────────────────────────────────────────
-- story_audio_pages.page_type is constrained to scene-flow values today.
-- Add 'page' so chapter-book narration can attach to a page index without
-- a scene_id (scene_id is already nullable on this table).
ALTER TABLE story_audio_pages
  DROP CONSTRAINT IF EXISTS story_audio_pages_page_type_check;
ALTER TABLE story_audio_pages
  ADD CONSTRAINT story_audio_pages_page_type_check
  CHECK (page_type IN ('cover', 'scene', 'quiz_transition', 'quiz_question', 'page'));
