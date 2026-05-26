-- PR 3 — Music track support, follow-up.
--
-- The sfx_library.duration_sec column was capped at 30s when the table
-- was created for SFX only. Music tracks need a longer cap (up to 3 min)
-- so they can hold short scene-underscoring loops.
--
-- We use IF EXISTS so the migration is safe to re-run even if the named
-- constraint differs slightly across environments.

ALTER TABLE sfx_library DROP CONSTRAINT IF EXISTS sfx_library_duration_sec_check;
ALTER TABLE sfx_library ADD CONSTRAINT sfx_library_duration_sec_check
  CHECK (duration_sec > 0 AND duration_sec <= 180);
