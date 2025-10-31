-- Little Artists Feature: Community Character Library
-- Creates tables for young artists to share their character sketches
-- Premium feature with parental consent and moderation workflow

-- ============================================
-- 1. LITTLE ARTISTS PROFILE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS little_artists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Artist Info
  name TEXT NOT NULL,
  age INTEGER CHECK (age >= 3 AND age <= 18),
  bio TEXT,
  profile_photo_url TEXT,

  -- Parent/Guardian
  parent_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_consent_given BOOLEAN DEFAULT FALSE,
  parent_consent_date TIMESTAMP WITH TIME ZONE,
  parent_consent_text TEXT,

  -- Status & Moderation
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published', 'archived')),
  featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,

  -- Admin Moderation
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  notification_sent_at TIMESTAMP WITH TIME ZONE,

  -- Stats
  artworks_count INTEGER DEFAULT 0,
  character_usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 2. ARTIST ARTWORKS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS artist_artworks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID NOT NULL REFERENCES little_artists(id) ON DELETE CASCADE,

  -- Artwork Images
  original_sketch_url TEXT NOT NULL,
  original_sketch_filename TEXT,
  animated_version_url TEXT,
  animated_version_filename TEXT,

  -- Link to Character Library
  character_library_id UUID REFERENCES character_library(id) ON DELETE SET NULL,

  -- Artwork Info
  title TEXT,
  description TEXT,
  character_name TEXT,

  -- Style Selection
  transformation_style TEXT DEFAULT 'sketch-to-character' CHECK (transformation_style IN ('sketch-to-character', 'cartoon', 'watercolor', 'realistic')),

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'processing', 'published', 'archived')),
  featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,

  -- Generation Metadata
  ai_prompt_used TEXT,
  generation_time_ms INTEGER,
  fal_request_id TEXT,
  cost_usd NUMERIC(10, 4),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- ============================================
-- 3. EXTEND CHARACTER_LIBRARY TABLE
-- ============================================

-- Add columns for artist attribution and public sharing
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'user' CHECK (source_type IN ('user', 'artist_community'));
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES little_artists(id) ON DELETE SET NULL;
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS artwork_id UUID REFERENCES artist_artworks(id) ON DELETE SET NULL;
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE character_library ADD COLUMN IF NOT EXISTS usage_count_total INTEGER DEFAULT 0;

-- ============================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_little_artists_parent_user ON little_artists(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_little_artists_status ON little_artists(status);
CREATE INDEX IF NOT EXISTS idx_little_artists_featured ON little_artists(featured) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_artist_artworks_artist ON artist_artworks(artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_artworks_character ON artist_artworks(character_library_id);
CREATE INDEX IF NOT EXISTS idx_artist_artworks_status ON artist_artworks(status);
CREATE INDEX IF NOT EXISTS idx_character_library_source ON character_library(source_type);
CREATE INDEX IF NOT EXISTS idx_character_library_public ON character_library(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_character_library_artist ON character_library(artist_id) WHERE artist_id IS NOT NULL;

-- ============================================
-- 5. TRIGGERS FOR AUTOMATIC COUNT UPDATES
-- ============================================

-- Update artwork count when artworks are added/removed
CREATE OR REPLACE FUNCTION update_artist_artwork_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE little_artists SET artworks_count = artworks_count + 1 WHERE id = NEW.artist_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE little_artists SET artworks_count = GREATEST(0, artworks_count - 1) WHERE id = OLD.artist_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_artist_artwork_count ON artist_artworks;
CREATE TRIGGER trigger_update_artist_artwork_count
AFTER INSERT OR DELETE ON artist_artworks
FOR EACH ROW EXECUTE FUNCTION update_artist_artwork_count();

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_little_artists_updated_at ON little_artists;
CREATE TRIGGER trigger_little_artists_updated_at
BEFORE UPDATE ON little_artists
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_artist_artworks_updated_at ON artist_artworks;
CREATE TRIGGER trigger_artist_artworks_updated_at
BEFORE UPDATE ON artist_artworks
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. CONSTRAINTS FOR LIMITS
-- ============================================

-- Constraint: Max 3 artists per parent
CREATE OR REPLACE FUNCTION check_artist_limit()
RETURNS TRIGGER AS $$
DECLARE
  artist_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO artist_count
  FROM little_artists
  WHERE parent_user_id = NEW.parent_user_id
    AND status != 'archived';

  IF artist_count >= 3 THEN
    RAISE EXCEPTION 'Maximum 3 artist profiles per parent account';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_artist_limit ON little_artists;
CREATE TRIGGER trigger_check_artist_limit
BEFORE INSERT ON little_artists
FOR EACH ROW EXECUTE FUNCTION check_artist_limit();

-- Constraint: Max 20 artworks per artist
CREATE OR REPLACE FUNCTION check_artwork_limit()
RETURNS TRIGGER AS $$
DECLARE
  artwork_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO artwork_count
  FROM artist_artworks
  WHERE artist_id = NEW.artist_id
    AND status != 'archived';

  IF artwork_count >= 20 THEN
    RAISE EXCEPTION 'Maximum 20 artworks per artist';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_artwork_limit ON artist_artworks;
CREATE TRIGGER trigger_check_artwork_limit
BEFORE INSERT ON artist_artworks
FOR EACH ROW EXECUTE FUNCTION check_artwork_limit();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on new tables
ALTER TABLE little_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE artist_artworks ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can manage their own children's profiles
DROP POLICY IF EXISTS little_artists_parent_access ON little_artists;
CREATE POLICY little_artists_parent_access ON little_artists
  FOR ALL USING (parent_user_id = auth.uid());

-- Policy: Published artist profiles are publicly viewable
DROP POLICY IF EXISTS little_artists_public_read ON little_artists;
CREATE POLICY little_artists_public_read ON little_artists
  FOR SELECT USING (status = 'published');

-- Policy: Parents can manage their children's artworks
DROP POLICY IF EXISTS artist_artworks_parent_access ON artist_artworks;
CREATE POLICY artist_artworks_parent_access ON artist_artworks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM little_artists
      WHERE little_artists.id = artist_artworks.artist_id
      AND little_artists.parent_user_id = auth.uid()
    )
  );

-- Policy: Published artworks are publicly viewable
DROP POLICY IF EXISTS artist_artworks_public_read ON artist_artworks;
CREATE POLICY artist_artworks_public_read ON artist_artworks
  FOR SELECT USING (status = 'published');

-- Policy: Public community characters are viewable by all
DROP POLICY IF EXISTS character_library_public_community ON character_library;
CREATE POLICY character_library_public_community ON character_library
  FOR SELECT USING (
    user_id = auth.uid() OR
    (is_public = TRUE AND source_type = 'artist_community')
  );

-- ============================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE little_artists IS 'Young artists who contribute character sketches to the community library';
COMMENT ON TABLE artist_artworks IS 'Original sketches and AI-transformed character artworks from little artists';
COMMENT ON COLUMN little_artists.status IS 'draft: private, pending_review: awaiting admin approval, published: public, archived: removed';
COMMENT ON COLUMN little_artists.parent_consent_given IS 'Parent must consent before profile can be published';
COMMENT ON COLUMN artist_artworks.transformation_style IS 'Style used for AI transformation: sketch-to-character (preserves style), cartoon, watercolor, realistic';
COMMENT ON COLUMN character_library.source_type IS 'user: personal character, artist_community: shared from little artist';
COMMENT ON COLUMN character_library.is_public IS 'Whether this character is available in the community library';
COMMENT ON COLUMN character_library.usage_count_total IS 'Total times this character has been used in stories';
