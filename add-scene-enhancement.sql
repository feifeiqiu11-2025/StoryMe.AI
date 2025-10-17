-- Migration: Add Scene Enhancement and Story Settings
-- Date: 2025-10-16
-- Description: Adds reading level, story tone, and scene enhancement fields

-- ============================================
-- 1. Add story-level settings to projects
-- ============================================

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS reading_level INTEGER DEFAULT 5
    CHECK (reading_level >= 3 AND reading_level <= 8),
ADD COLUMN IF NOT EXISTS story_tone VARCHAR(50) DEFAULT 'playful'
    CHECK (story_tone IN ('playful', 'educational', 'adventure', 'gentle', 'silly', 'mystery', 'friendly', 'brave'));

COMMENT ON COLUMN projects.reading_level IS 'Target reading age for story captions (3-8 years)';
COMMENT ON COLUMN projects.story_tone IS 'Narrative tone/theme for story captions (playful, educational, adventure, etc.)';

-- ============================================
-- 2. Add enhancement fields to scenes
-- ============================================

ALTER TABLE scenes
ADD COLUMN IF NOT EXISTS raw_description TEXT,
ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT,
ADD COLUMN IF NOT EXISTS caption TEXT;

COMMENT ON COLUMN scenes.raw_description IS 'Original user input before AI enhancement';
COMMENT ON COLUMN scenes.enhanced_prompt IS 'AI-enhanced description optimized for image generation (preserves character names, adds visual details)';
COMMENT ON COLUMN scenes.caption IS 'Age-appropriate story caption for PDF storybook (based on reading_level and story_tone from project)';

-- ============================================
-- 3. Migrate existing data (backward compatibility)
-- ============================================

UPDATE scenes
SET
  raw_description = COALESCE(raw_description, description),
  enhanced_prompt = COALESCE(enhanced_prompt, description),
  caption = COALESCE(caption, description)
WHERE raw_description IS NULL;

-- ============================================
-- 4. Verification queries
-- ============================================

-- Check projects table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'projects'
  AND column_name IN ('reading_level', 'story_tone')
ORDER BY ordinal_position;

-- Check scenes table columns
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'scenes'
  AND column_name IN ('raw_description', 'enhanced_prompt', 'caption')
ORDER BY ordinal_position;

-- ============================================
-- Notes:
-- ============================================
-- - reading_level: Stored only at project level (not per scene)
-- - story_tone: Stored only at project level (not per scene)
-- - All scenes in a project inherit the same reading level and tone
-- - Keep 'description' column for backward compatibility with existing code
-- - In new flow: description = enhanced_prompt (for image generation)
