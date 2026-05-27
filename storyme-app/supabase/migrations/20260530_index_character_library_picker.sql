-- Indexes for the Import-from-Library modal on the Create Story page.
--
-- The modal issues two recurring queries:
--   1. Mine:      WHERE user_id = $1                ORDER BY created_at DESC LIMIT 24
--   2. Community: WHERE is_public = TRUE            ORDER BY created_at DESC LIMIT 24
--
-- Without supporting indexes both queries scan the whole table and sort,
-- which is the dominant latency once the table grows. These composite
-- indexes cover both the filter and the ordering so the planner can do
-- an index-only range scan and stop after one page.

CREATE INDEX IF NOT EXISTS idx_character_library_user_recent
  ON character_library (user_id, created_at DESC);

-- Partial index keyed on is_public is much smaller than a full index
-- because the column is highly selective (only a fraction of rows are
-- public). Mirrors the existing partial index pattern in
-- 20260322_add_tags_and_designer_to_character_library.sql.
CREATE INDEX IF NOT EXISTS idx_character_library_public_recent
  ON character_library (created_at DESC)
  WHERE is_public = TRUE;
