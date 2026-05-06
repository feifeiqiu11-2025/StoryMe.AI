-- Unlisted story sharing via share tokens.
-- Adds a third visibility value 'unlisted' and a per-story share_token so
-- teachers (and any user) can share a story by link without publishing to
-- the community page.
--
-- Companion code:
--   - storyme-app/src/lib/services/storyShare.service.ts
--   - storyme-app/src/app/api/stories/[id]/share-link/route.ts
--   - storyme-app/src/app/api/stories/public/[id]/route.ts (?token= path)

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Widen visibility to include 'unlisted'
-- ─────────────────────────────────────────────────────────────────────────
-- The original schema may or may not have a CHECK constraint on visibility.
-- Drop any existing one defensively, then add an explicit named constraint
-- so future migrations can target it predictably.
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_visibility_check;
ALTER TABLE projects ADD CONSTRAINT projects_visibility_check
  CHECK (visibility IS NULL OR visibility IN ('private', 'unlisted', 'public'));

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Add share_token column
-- ─────────────────────────────────────────────────────────────────────────
-- Nullable: only populated when share-link is enabled. UNIQUE so a token
-- can be looked up directly without scanning. Stored as UUID for the same
-- entropy guarantees the rest of the schema relies on.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE;

CREATE INDEX IF NOT EXISTS idx_projects_share_token
  ON projects(share_token)
  WHERE share_token IS NOT NULL;

COMMENT ON COLUMN projects.share_token IS
  'Share-link token for unlisted stories. NULL when share-link is disabled. '
  'Regenerating rotates the value, immediately invalidating any old link.';
