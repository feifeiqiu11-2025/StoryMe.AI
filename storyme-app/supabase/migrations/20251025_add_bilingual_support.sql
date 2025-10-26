-- ============================================
-- Migration: Add Multi-Language Support
-- Date: 2025-10-25
-- Supports: Scenario 1 (Chinese only) + Scenario 2 (Bilingual)
-- ============================================

-- ============================================
-- 1. Projects Table - Content Language
-- ============================================
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS content_language VARCHAR(10) DEFAULT 'en',
ADD COLUMN IF NOT EXISTS supported_languages JSONB DEFAULT '["en"]'::jsonb,
ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- Create index for filtering by language
CREATE INDEX IF NOT EXISTS idx_projects_content_language ON projects(content_language);

-- Migrate existing data to new i18n columns
UPDATE projects
SET
  title_i18n = CASE
    WHEN title IS NOT NULL THEN jsonb_build_object('en', title)
    ELSE '{}'::jsonb
  END,
  description_i18n = CASE
    WHEN description IS NOT NULL THEN jsonb_build_object('en', description)
    ELSE '{}'::jsonb
  END,
  content_language = 'en',
  supported_languages = '["en"]'::jsonb
WHERE title_i18n = '{}'::jsonb OR title_i18n IS NULL;

-- Add helpful comments
COMMENT ON COLUMN projects.content_language IS 'Primary content language: en, zh, es, fr, etc. For Scenario 1 (single language) or Scenario 2 (primary in bilingual)';
COMMENT ON COLUMN projects.supported_languages IS 'Array of supported language codes. Scenario 1: ["zh"], Scenario 2: ["en", "zh"]';
COMMENT ON COLUMN projects.title_i18n IS 'Multi-language titles: {"en": "...", "zh": "..."}. Supports Scenario 2 bilingual display.';
COMMENT ON COLUMN projects.description_i18n IS 'Multi-language descriptions: {"en": "...", "zh": "..."}';


-- ============================================
-- 2. Scenes Table - Multi-Language Captions
-- ============================================
ALTER TABLE scenes
ADD COLUMN IF NOT EXISTS captions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS simplified_texts JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS enhanced_prompt TEXT;

-- Migrate existing English captions to new JSONB format
UPDATE scenes
SET
  captions = CASE
    WHEN caption IS NOT NULL THEN jsonb_build_object('en', caption)
    ELSE '{}'::jsonb
  END,
  simplified_texts = CASE
    WHEN simplified_text IS NOT NULL THEN jsonb_build_object('en', simplified_text)
    ELSE '{}'::jsonb
  END
WHERE captions = '{}'::jsonb OR captions IS NULL;

-- Create GIN index for efficient JSONB queries
CREATE INDEX IF NOT EXISTS idx_scenes_captions_gin ON scenes USING GIN (captions);
CREATE INDEX IF NOT EXISTS idx_scenes_simplified_texts_gin ON scenes USING GIN (simplified_texts);

-- Add helpful comments
COMMENT ON COLUMN scenes.captions IS 'Multi-language captions as JSONB. Scenario 1: {"zh": "小兔子..."}, Scenario 2: {"en": "Little rabbit...", "zh": "小兔子..."}';
COMMENT ON COLUMN scenes.simplified_texts IS 'Simplified/easy-read versions in multiple languages. Same JSONB structure as captions.';
COMMENT ON COLUMN scenes.enhanced_prompt IS 'AI-enhanced prompt for image generation. Always in English for optimal DALL-E/Fal.ai results.';


-- ============================================
-- 3. Quiz Questions - Multi-Language Support
-- ============================================
ALTER TABLE quiz_questions
ADD COLUMN IF NOT EXISTS question_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS option_a_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS option_b_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS option_c_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS option_d_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS explanation_i18n JSONB DEFAULT '{}'::jsonb;

-- Migrate existing English quiz data
UPDATE quiz_questions
SET
  question_i18n = CASE
    WHEN question IS NOT NULL THEN jsonb_build_object('en', question)
    ELSE '{}'::jsonb
  END,
  option_a_i18n = CASE
    WHEN option_a IS NOT NULL THEN jsonb_build_object('en', option_a)
    ELSE '{}'::jsonb
  END,
  option_b_i18n = CASE
    WHEN option_b IS NOT NULL THEN jsonb_build_object('en', option_b)
    ELSE '{}'::jsonb
  END,
  option_c_i18n = CASE
    WHEN option_c IS NOT NULL THEN jsonb_build_object('en', option_c)
    ELSE '{}'::jsonb
  END,
  option_d_i18n = CASE
    WHEN option_d IS NOT NULL THEN jsonb_build_object('en', option_d)
    ELSE '{}'::jsonb
  END,
  explanation_i18n = CASE
    WHEN explanation IS NOT NULL THEN jsonb_build_object('en', explanation)
    ELSE '{}'::jsonb
  END
WHERE question_i18n = '{}'::jsonb OR question_i18n IS NULL;

-- Create GIN indexes for quiz JSONB columns
CREATE INDEX IF NOT EXISTS idx_quiz_question_i18n_gin ON quiz_questions USING GIN (question_i18n);

-- Add helpful comments
COMMENT ON COLUMN quiz_questions.question_i18n IS 'Multi-language question text: {"en": "What did...", "zh": "什么..."}';
COMMENT ON COLUMN quiz_questions.option_a_i18n IS 'Multi-language option A: {"en": "...", "zh": "..."}';
COMMENT ON COLUMN quiz_questions.option_b_i18n IS 'Multi-language option B';
COMMENT ON COLUMN quiz_questions.option_c_i18n IS 'Multi-language option C';
COMMENT ON COLUMN quiz_questions.option_d_i18n IS 'Multi-language option D';
COMMENT ON COLUMN quiz_questions.explanation_i18n IS 'Multi-language explanation shown after answer';


-- ============================================
-- 4. Story Audio Pages - Language Variants
-- ============================================
ALTER TABLE story_audio_pages
ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en';

-- Set existing audio to 'en'
UPDATE story_audio_pages
SET language = 'en'
WHERE language IS NULL;

-- Create composite index for efficient audio lookups by language
CREATE INDEX IF NOT EXISTS idx_audio_pages_project_lang_page
  ON story_audio_pages(project_id, language, page_number);

-- Add constraint to ensure language is valid (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_audio_language'
  ) THEN
    ALTER TABLE story_audio_pages
    ADD CONSTRAINT check_audio_language
      CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'); -- en, zh, zh-CN, etc.
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN story_audio_pages.language IS 'Audio narration language: en, zh, es, etc. For Scenario 2, same page_number can have multiple language rows.';


-- ============================================
-- 5. Helper Functions
-- ============================================

-- Function: Get caption in specific language with fallback
CREATE OR REPLACE FUNCTION get_caption(
  p_captions JSONB,
  p_language VARCHAR(10),
  p_fallback_language VARCHAR(10) DEFAULT 'en'
)
RETURNS TEXT AS $$
BEGIN
  -- Try requested language
  IF p_captions ? p_language THEN
    RETURN p_captions->>p_language;
  END IF;

  -- Fallback to default language
  IF p_captions ? p_fallback_language THEN
    RETURN p_captions->>p_fallback_language;
  END IF;

  -- Return first available language
  RETURN p_captions->>jsonb_object_keys(p_captions) LIMIT 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_caption IS 'Helper to get caption in preferred language with fallback. Usage: SELECT get_caption(captions, ''zh'', ''en'') FROM scenes;';


-- Function: Check if project supports a language
CREATE OR REPLACE FUNCTION supports_language(
  p_supported_languages JSONB,
  p_language VARCHAR(10)
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN p_supported_languages @> to_jsonb(p_language);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION supports_language IS 'Check if a project supports a language. Usage: SELECT * FROM projects WHERE supports_language(supported_languages, ''zh'');';


-- ============================================
-- 6. Data Validation Views (Optional)
-- ============================================

-- View: Projects missing translations
CREATE OR REPLACE VIEW projects_missing_translations AS
SELECT
  id,
  title_i18n,
  content_language,
  supported_languages,
  ARRAY(
    SELECT jsonb_array_elements_text(supported_languages)
    EXCEPT
    SELECT jsonb_object_keys(title_i18n)
  ) AS missing_title_languages,
  ARRAY(
    SELECT jsonb_array_elements_text(supported_languages)
    EXCEPT
    SELECT jsonb_object_keys(description_i18n)
  ) AS missing_description_languages
FROM projects
WHERE jsonb_array_length(supported_languages) > (
  SELECT COUNT(*) FROM jsonb_object_keys(title_i18n)
);

COMMENT ON VIEW projects_missing_translations IS 'Shows projects that claim to support languages but are missing translations';


-- ============================================
-- 7. Example Usage Queries
-- ============================================

/*
-- SCENARIO 1: Chinese-only story
INSERT INTO projects (user_id, content_language, supported_languages, title_i18n)
VALUES (
  'user-uuid',
  'zh',
  '["zh"]'::jsonb,
  '{"zh": "小兔子找朋友"}'::jsonb
);

INSERT INTO scenes (project_id, scene_number, captions, enhanced_prompt)
VALUES (
  'project-uuid',
  1,
  '{"zh": "小兔子在森林里寻找新朋友"}'::jsonb,
  'A cute white rabbit hopping through a magical forest...'
);

-- SCENARIO 2: Bilingual story
INSERT INTO projects (user_id, content_language, supported_languages, title_i18n)
VALUES (
  'user-uuid',
  'en',
  '["en", "zh"]'::jsonb,
  '{"en": "The Little Rabbit Finds Friends", "zh": "小兔子找朋友"}'::jsonb
);

INSERT INTO scenes (project_id, scene_number, captions, enhanced_prompt)
VALUES (
  'project-uuid',
  1,
  '{"en": "The little rabbit was looking for new friends", "zh": "小兔子在森林里寻找新朋友"}'::jsonb,
  'A cute white rabbit hopping through a magical forest...'
);

-- Insert audio for both languages
INSERT INTO story_audio_pages (project_id, page_number, language, audio_url)
VALUES
  ('project-uuid', 1, 'en', 'audio/en/page-1.mp3'),
  ('project-uuid', 1, 'zh', 'audio/zh/page-1.mp3');

-- Query: Get all scenes with Chinese captions
SELECT
  scene_number,
  captions->>'zh' AS chinese_caption,
  enhanced_prompt
FROM scenes
WHERE project_id = 'project-uuid'
  AND captions ? 'zh';

-- Query: Get audio for specific language
SELECT audio_url
FROM story_audio_pages
WHERE project_id = 'project-uuid'
  AND language = 'zh'
ORDER BY page_number;
*/
