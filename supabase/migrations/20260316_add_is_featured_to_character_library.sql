-- ============================================
-- Add is_featured column to character_library
-- Allows admin to feature characters in the Little Artists hero carousel
-- ============================================

ALTER TABLE character_library
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- Index for efficiently querying featured public characters
CREATE INDEX IF NOT EXISTS idx_character_library_featured
  ON character_library(is_featured, created_at DESC)
  WHERE is_public = TRUE AND is_featured = TRUE;

COMMENT ON COLUMN character_library.is_featured IS 'Admin-selected featured character for Little Artists hero carousel';
