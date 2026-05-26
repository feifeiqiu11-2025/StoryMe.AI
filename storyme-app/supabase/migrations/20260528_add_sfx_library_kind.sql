-- PR 3 — Music track support.
--
-- Adds a `kind` column to sfx_library so the same table can hold short
-- sound effects AND longer music tracks without a parallel music_library
-- infrastructure (same storage bucket, same RLS, same import + seed flow).
--
-- Existing rows are all "sfx" (default). Newer rows for music carry
-- kind='music'. The library API + recorder browser panel filter by kind
-- so users see Sounds and Music as separate top-level tabs.

ALTER TABLE sfx_library
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'sfx'
    CHECK (kind IN ('sfx', 'music'));

-- Index for kind-filtered queries — every library list call passes a
-- kind filter so this gets hit often.
CREATE INDEX IF NOT EXISTS idx_sfx_library_kind ON sfx_library (kind);

COMMENT ON COLUMN sfx_library.kind IS
  'sfx = short sound effect; music = longer instrumental track for background scoring.';
