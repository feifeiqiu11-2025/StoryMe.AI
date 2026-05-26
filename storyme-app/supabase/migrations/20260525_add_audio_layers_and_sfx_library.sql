-- Phase 2b foundation — layered audio + sound effects library.
--
-- Adds:
--   1. story_audio_pages.audio_layers (JSONB)
--      Versioned layer composition for a page. When NULL: page is
--      "single-track" (vocal in audio_url, pre-layers behavior). When set:
--      audio_url is the server-rendered mix of these layers, and layers are
--      the source of truth for re-mixing.
--
--      Shape (matches lib/audio/layers.types.ts):
--        {
--          version: 1,
--          vocal: { url, durationSec, trimStartSec?, trimEndSec?, volumeDb? },
--          music: [{ id, url, sfxLibraryId?, startSec, durationSec, volumeDb?, duckUnderVocal? }],
--          effects: [{ id, url, sfxLibraryId?, startSec, durationSec, volumeDb? }]
--        }
--
--   2. sfx_library — curated + imported sound effects available to all users.
--      Curated rows are seeded by an admin script with CC0 audio uploaded to
--      the `sfx-library` storage bucket. Freesound imports and ElevenLabs
--      cache entries are de-duped by (source, external_id).

ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS audio_layers JSONB;

COMMENT ON COLUMN story_audio_pages.audio_layers IS
  'Versioned layer composition (v1: vocal + music[] + effects[]). NULL means single-track vocal in audio_url (pre-layers). When set, audio_url is the server-rendered mix.';

CREATE TABLE IF NOT EXISTS sfx_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  audio_url TEXT NOT NULL,
  duration_sec NUMERIC NOT NULL CHECK (duration_sec > 0 AND duration_sec <= 30),
  source TEXT NOT NULL CHECK (source IN ('curated', 'freesound', 'elevenlabs_cache')),
  external_id TEXT,
  kid_safe BOOLEAN NOT NULL DEFAULT true,
  attribution TEXT,
  license TEXT NOT NULL DEFAULT 'CC0' CHECK (license IN ('CC0', 'CC-BY', 'proprietary')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sfx_library_source ON sfx_library(source);
CREATE INDEX IF NOT EXISTS idx_sfx_library_tags ON sfx_library USING GIN(tags);
-- De-duplicate Freesound imports + ElevenLabs cached generations by source id.
-- Partial uniqueness lets curated rows (with NULL external_id) coexist freely.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sfx_library_external
  ON sfx_library(source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE sfx_library ENABLE ROW LEVEL SECURITY;

-- Read: every authenticated user can browse the library.
DROP POLICY IF EXISTS "sfx_library_public_read" ON sfx_library;
CREATE POLICY "sfx_library_public_read"
  ON sfx_library FOR SELECT
  USING (true);

-- Writes intentionally not exposed via RLS — service role only (admin
-- curation script + the ElevenLabs/Freesound proxy routes that run with
-- the service key).
