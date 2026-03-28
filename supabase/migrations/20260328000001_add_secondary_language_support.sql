-- Multi-Language Secondary Caption & Narration Support
-- Adds generic secondary language fields alongside existing Chinese-specific columns.
-- Chinese columns (caption_chinese, audio_url_zh, text_content_zh) are NOT removed
-- for backward compatibility with the KindleWood Kids mobile app.

-- 1. Add secondary_language to projects (generic field)
-- Values: 'zh', 'ko', 'es', null (no secondary language)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS secondary_language VARCHAR(10);

-- 2. Add generic secondary caption to scenes
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS caption_secondary TEXT;

-- 3. Add generic secondary audio fields to story_audio_pages
ALTER TABLE story_audio_pages ADD COLUMN IF NOT EXISTS audio_url_secondary TEXT;
ALTER TABLE story_audio_pages ADD COLUMN IF NOT EXISTS text_content_secondary TEXT;

-- 4. Backfill existing Chinese data → generic columns
-- Set secondary_language = 'zh' for projects that have Chinese captions
UPDATE projects p SET secondary_language = 'zh'
WHERE EXISTS (
  SELECT 1 FROM scenes s
  WHERE s.project_id = p.id AND s.caption_chinese IS NOT NULL AND s.caption_chinese != ''
);

-- Copy caption_chinese → caption_secondary for existing scenes
UPDATE scenes SET caption_secondary = caption_chinese
WHERE caption_chinese IS NOT NULL AND caption_chinese != '';

-- Copy audio zh columns → secondary columns for existing audio pages
UPDATE story_audio_pages SET
  audio_url_secondary = audio_url_zh,
  text_content_secondary = text_content_zh
WHERE audio_url_zh IS NOT NULL OR text_content_zh IS NOT NULL;

-- 5. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_projects_secondary_language
  ON projects(secondary_language) WHERE secondary_language IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scenes_caption_secondary
  ON scenes(caption_secondary) WHERE caption_secondary IS NOT NULL;
