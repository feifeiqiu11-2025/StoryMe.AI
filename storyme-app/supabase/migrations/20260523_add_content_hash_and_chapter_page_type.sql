-- Audio narration support for chapter books.
--
-- Adds:
--   1. content_hash: SHA-256 of the normalized page text at the moment the audio
--      was generated/recorded. Used to detect "stale" audio when the underlying
--      text changes (chapter book editor edits, picture book caption edits).
--      Normalization rule (must match writer-side hashing in
--      lib/audio/content-hash.ts): trim each line, collapse internal whitespace
--      to single spaces, preserve all punctuation (commas/periods drive TTS
--      pauses). NULL on rows generated before this migration — treat NULL as
--      "unknown / never stale" for backward compat.
--
--   2. 'chapter_page' page_type: chapter books emit one audio row per Tiptap
--      page (page boundaries are explicit pageBreak nodes — see
--      lib/chapter-book/docToPages.ts). Reuses the existing quiz_transition /
--      quiz_question types when chapter-book quiz support lands later.

ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_audio_pages_content_hash
  ON story_audio_pages(project_id, content_hash)
  WHERE content_hash IS NOT NULL;

ALTER TABLE story_audio_pages
  DROP CONSTRAINT IF EXISTS story_audio_pages_page_type_check;

ALTER TABLE story_audio_pages
  ADD CONSTRAINT story_audio_pages_page_type_check
  CHECK (page_type IN ('cover', 'scene', 'quiz_transition', 'quiz_question', 'chapter_page'));
