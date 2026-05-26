-- PR 2 — Persistent edit mode for chapter book audio.
--
-- Splits a page's audio lifecycle into TWO server-side states:
--
--   1. DRAFT  (draft_vocal_url + draft_layers + draft_updated_at)
--      In-progress editing. The user has uploaded a raw vocal, may have
--      made trims, splits, cuts, or added SFX placements. Nothing has
--      been rendered into the book yet. Survives close + reopen.
--
--   2. COMMITTED  (audio_url + audio_layers + committed_at)
--      "Finish & Continue" produced a final mixed MP3. The draft columns
--      get cleared. Re-opening a committed page initialises a NEW draft
--      from the committed audio (re-edits layer on top of the previous
--      flattened mix — previous individual SFX clips become baked in).
--
-- audio_url + audio_layers stay as they were. Only the draft_* columns
-- and committed_at are new. Backfill is unnecessary: existing rows with
-- no draft columns simply read as "no active draft," and the hydration
-- code falls back to audio_url to seed a fresh in-memory draft.

ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS draft_vocal_url    TEXT,
  ADD COLUMN IF NOT EXISTS draft_layers       JSONB,
  ADD COLUMN IF NOT EXISTS draft_updated_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS committed_at       TIMESTAMPTZ;

COMMENT ON COLUMN story_audio_pages.draft_vocal_url IS
  'Raw vocal blob URL for in-progress editing. Cleared on Finish & Continue. NULL = no active draft.';
COMMENT ON COLUMN story_audio_pages.draft_layers IS
  'In-progress audio_layers spec, separate from the committed snapshot stored in audio_layers.';
COMMENT ON COLUMN story_audio_pages.draft_updated_at IS
  'Last time Save draft (or auto-save) wrote to this row.';
COMMENT ON COLUMN story_audio_pages.committed_at IS
  'Last time Finish & Continue produced a fresh audio_url.';
