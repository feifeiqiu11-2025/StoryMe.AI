-- ============================================
-- Track a project's first completion, so editing an existing story is free
-- ============================================
--
-- Bug: editing a story reverts it to draft and re-saves it through
-- /api/projects/save, which treated every completion as a NEW story — so
-- editing was blocked at the monthly limit AND double-counted the quota.
--
-- Fix: mark the first time a project reaches completed status. Re-saves of an
-- already-marked story are edits: they bypass the create limit and don't
-- re-increment. Only genuinely new stories are gated by the quota.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS first_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN projects.first_completed_at IS
  'Set the first time a project reaches completed status (and is counted toward the monthly story quota). Re-saving after an edit is free once this is set.';

-- Backfill 1: existing completed stories are already counted — editing them
-- must not re-charge.
UPDATE projects
SET first_completed_at = created_at
WHERE status = 'completed' AND first_completed_at IS NULL;

-- Backfill 2: stories currently reverted to draft for editing can't be detected
-- by status, but published_at is only ever set on a completed story — use it to
-- catch those that were once public.
UPDATE projects
SET first_completed_at = COALESCE(published_at, created_at)
WHERE published_at IS NOT NULL AND first_completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_first_completed_at
  ON projects(first_completed_at) WHERE first_completed_at IS NOT NULL;
