-- Storage bucket for the sound-effects library — public-readable so audio
-- preview/playback works without signed URLs. Writes restricted to the
-- service role (admin curation script + Freesound/ElevenLabs proxy routes).
--
-- Path conventions inside the bucket:
--   curated/<safe-name>.mp3         — hand-picked CC0 starter set
--   freesound/<freesound_id>.mp3    — user-imported via the search proxy
--   elevenlabs/<prompt_hash>.mp3    — cached AI generations (Phase 2b-3c)

INSERT INTO storage.buckets (id, name, public)
VALUES ('sfx-library', 'sfx-library', true)
ON CONFLICT (id) DO NOTHING;

-- Public read for everyone — these files are CC0 / commercially cleared.
DROP POLICY IF EXISTS "sfx_library_storage_public_read" ON storage.objects;
CREATE POLICY "sfx_library_storage_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'sfx-library');

-- Writes intentionally not exposed — service-role key only (seed script +
-- server-side proxy routes). No SELECT-anon write policy by design.
