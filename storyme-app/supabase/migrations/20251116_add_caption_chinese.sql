-- ============================================
-- Migration: Add caption_chinese for Bilingual PDF Support
-- Date: 2025-11-16
-- Purpose: Support English stories with optional Chinese captions for PDF export only
-- ============================================

-- Add caption_chinese field to scenes table
ALTER TABLE scenes
ADD COLUMN IF NOT EXISTS caption_chinese TEXT;

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_scenes_caption_chinese ON scenes(caption_chinese) WHERE caption_chinese IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN scenes.caption_chinese IS 'Optional Chinese translation of caption for bilingual PDF export. Only for NEW stories created after Nov 2025.';
