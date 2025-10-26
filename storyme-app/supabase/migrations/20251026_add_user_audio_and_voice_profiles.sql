-- ============================================
-- Migration: Add User Audio Recording + Voice Cloning Support
-- Date: 2025-10-26
-- Features:
--   1. User-recorded audio (immediate feature)
--   2. Voice profile training samples (future AI voice cloning)
--   3. Custom voice models (ElevenLabs, PlayHT, etc.)
-- ============================================

-- ============================================
-- 1. Voice Profiles Table (For Voice Cloning)
-- ============================================

CREATE TABLE IF NOT EXISTS voice_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Profile metadata
  profile_name VARCHAR(100) NOT NULL, -- "Mom's Voice", "Dad's Voice", "Emma (age 7)"
  profile_type VARCHAR(20) NOT NULL DEFAULT 'user_recorded',
    -- 'user_recorded': Direct recording, no AI
    -- 'voice_clone_pending': Training samples uploaded, not yet trained
    -- 'voice_clone_ready': AI model trained and ready
    -- 'voice_clone_failed': Training failed

  -- Owner/subject
  voice_owner VARCHAR(50), -- "parent", "child", "grandparent", etc.
  age_at_recording INTEGER, -- Useful for child voices that change over time

  -- Training samples (for voice cloning)
  training_samples JSONB DEFAULT '[]'::jsonb,
    -- [
    --   {"audio_url": "...", "duration_seconds": 45, "text_content": "sample text", "uploaded_at": "..."},
    --   {"audio_url": "...", "duration_seconds": 60, "text_content": null, "uploaded_at": "..."}
    -- ]
  total_training_duration_seconds INTEGER DEFAULT 0, -- Sum of all training samples

  -- AI voice model details (future)
  ai_provider VARCHAR(50), -- 'elevenlabs', 'playht', 'openai', 'resemble', null
  ai_model_id VARCHAR(255), -- External provider's voice model ID
  ai_model_status VARCHAR(20), -- 'training', 'ready', 'failed'
  ai_model_metadata JSONB DEFAULT '{}'::jsonb, -- Provider-specific settings

  -- Quality/status
  quality_score FLOAT, -- 0-100, based on training sample quality (future)
  is_active BOOLEAN DEFAULT TRUE, -- User can deactivate old voice profiles

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  trained_at TIMESTAMPTZ, -- When AI model was successfully trained

  -- Constraints
  CONSTRAINT unique_profile_name_per_user UNIQUE(user_id, profile_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_profiles_user_id ON voice_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_type ON voice_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_voice_profiles_active ON voice_profiles(is_active) WHERE is_active = TRUE;

-- RLS Policies
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own voice profiles"
  ON voice_profiles
  FOR ALL
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE voice_profiles IS 'Voice profiles for user recordings and AI voice cloning. Supports direct recording + future voice cloning models.';
COMMENT ON COLUMN voice_profiles.profile_type IS 'user_recorded (no AI), voice_clone_pending (training), voice_clone_ready (AI ready)';
COMMENT ON COLUMN voice_profiles.training_samples IS 'Array of training audio samples for voice cloning. 30-60s recommended for good quality.';
COMMENT ON COLUMN voice_profiles.ai_provider IS 'Voice cloning provider: elevenlabs, playht, openai, resemble, etc.';
COMMENT ON COLUMN voice_profiles.ai_model_id IS 'External provider voice model ID for API calls';


-- ============================================
-- 2. Enhance story_audio_pages (User Audio Support)
-- ============================================

-- Add columns for user audio and voice profile linking
ALTER TABLE story_audio_pages
  ADD COLUMN IF NOT EXISTS audio_source VARCHAR(20) DEFAULT 'ai_tts',
  ADD COLUMN IF NOT EXISTS voice_profile_id UUID REFERENCES voice_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recording_metadata JSONB DEFAULT '{}'::jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_audio_pages_source ON story_audio_pages(audio_source);
CREATE INDEX IF NOT EXISTS idx_audio_pages_voice_profile ON story_audio_pages(voice_profile_id);

-- Add check constraint for audio_source values
ALTER TABLE story_audio_pages
  DROP CONSTRAINT IF EXISTS check_audio_source;

ALTER TABLE story_audio_pages
  ADD CONSTRAINT check_audio_source
    CHECK (audio_source IN ('ai_tts', 'user_recorded', 'ai_voice_clone'));

-- Comments
COMMENT ON COLUMN story_audio_pages.audio_source IS 'Audio generation method: ai_tts (OpenAI TTS), user_recorded (direct recording), ai_voice_clone (trained voice model)';
COMMENT ON COLUMN story_audio_pages.voice_profile_id IS 'Links to voice_profiles for user recordings or voice clones. NULL for standard AI TTS.';
COMMENT ON COLUMN story_audio_pages.recorded_by_user_id IS 'User who recorded/uploaded the audio (for user_recorded type)';
COMMENT ON COLUMN story_audio_pages.recording_metadata IS 'Recording details: {"device": "mobile", "duration_ms": 5200, "retries": 2, "browser": "Chrome"}';


-- ============================================
-- 3. Voice Training Samples Table (Optional - For Better Organization)
-- ============================================

-- Alternative: Store training samples in separate table instead of JSONB
-- This provides better queryability and file management
CREATE TABLE IF NOT EXISTS voice_training_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_profile_id UUID NOT NULL REFERENCES voice_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Sample audio
  audio_url TEXT NOT NULL,
  audio_filename VARCHAR(255) NOT NULL,
  duration_seconds FLOAT NOT NULL,
  file_size_bytes BIGINT,

  -- Transcription (optional, helps with training)
  text_content TEXT, -- What was said in the audio
  language VARCHAR(10) DEFAULT 'en',

  -- Quality metrics
  quality_score FLOAT, -- AI-analyzed quality (noise level, clarity, etc.)
  is_approved BOOLEAN DEFAULT TRUE, -- User can exclude low-quality samples

  -- Metadata
  recording_device VARCHAR(50), -- 'mobile', 'desktop', 'professional_mic'
  sample_metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_duration CHECK (duration_seconds > 0 AND duration_seconds <= 300) -- Max 5 min per sample
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_training_samples_profile ON voice_training_samples(voice_profile_id);
CREATE INDEX IF NOT EXISTS idx_training_samples_user ON voice_training_samples(user_id);
CREATE INDEX IF NOT EXISTS idx_training_samples_approved ON voice_training_samples(is_approved) WHERE is_approved = TRUE;

-- RLS Policies
ALTER TABLE voice_training_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their training samples"
  ON voice_training_samples
  FOR ALL
  USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE voice_training_samples IS 'Training audio samples for AI voice cloning. Users upload 30-60s samples to train custom voice models.';
COMMENT ON COLUMN voice_training_samples.text_content IS 'Transcript of audio sample. Improves voice cloning quality when provided.';
COMMENT ON COLUMN voice_training_samples.quality_score IS 'AI-analyzed audio quality (0-100). Helps filter out noisy/poor samples.';


-- ============================================
-- 4. Helper Functions
-- ============================================

-- Function: Get total training duration for a voice profile
CREATE OR REPLACE FUNCTION get_voice_profile_training_duration(p_voice_profile_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(duration_seconds)::INTEGER, 0)
  FROM voice_training_samples
  WHERE voice_profile_id = p_voice_profile_id
    AND is_approved = TRUE;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION get_voice_profile_training_duration IS 'Calculate total approved training sample duration for a voice profile';


-- Function: Check if voice profile has enough training data
CREATE OR REPLACE FUNCTION is_voice_profile_ready_for_training(p_voice_profile_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  total_duration INTEGER;
  sample_count INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(duration_seconds)::INTEGER, 0),
    COUNT(*)
  INTO total_duration, sample_count
  FROM voice_training_samples
  WHERE voice_profile_id = p_voice_profile_id
    AND is_approved = TRUE;

  -- Require at least 30 seconds total and at least 1 sample
  -- Most voice cloning services need 30-60s minimum
  RETURN (total_duration >= 30 AND sample_count >= 1);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_voice_profile_ready_for_training IS 'Check if voice profile has minimum 30s of training data (industry standard)';


-- Function: Update voice profile training duration (trigger)
CREATE OR REPLACE FUNCTION update_voice_profile_training_duration()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE voice_profiles
  SET
    total_training_duration_seconds = (
      SELECT COALESCE(SUM(duration_seconds)::INTEGER, 0)
      FROM voice_training_samples
      WHERE voice_profile_id = COALESCE(NEW.voice_profile_id, OLD.voice_profile_id)
        AND is_approved = TRUE
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.voice_profile_id, OLD.voice_profile_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Auto-update training duration when samples change
DROP TRIGGER IF EXISTS trigger_update_training_duration ON voice_training_samples;
CREATE TRIGGER trigger_update_training_duration
  AFTER INSERT OR UPDATE OR DELETE ON voice_training_samples
  FOR EACH ROW
  EXECUTE FUNCTION update_voice_profile_training_duration();


-- ============================================
-- 5. Data Migration - Set Existing Audio
-- ============================================

-- Mark all existing audio as AI TTS
UPDATE story_audio_pages
SET audio_source = 'ai_tts'
WHERE audio_source IS NULL;

-- Set language if not set (from earlier migration)
UPDATE story_audio_pages
SET language = 'en'
WHERE language IS NULL;


-- ============================================
-- 6. Example Usage Queries
-- ============================================

/*
-- SCENARIO 1: User records audio directly (no AI voice cloning)
-- Create a simple voice profile for organization
INSERT INTO voice_profiles (user_id, profile_name, profile_type, voice_owner)
VALUES (
  'user-uuid',
  'Mom''s Voice',
  'user_recorded',
  'parent'
);

-- Upload user-recorded audio for a story page
INSERT INTO story_audio_pages (
  project_id,
  page_number,
  page_type,
  text_content,
  audio_url,
  audio_source,
  voice_profile_id,
  recorded_by_user_id,
  language
)
VALUES (
  'project-uuid',
  1,
  'cover',
  'The Little Rabbit, by Emma, age 7',
  'story-audio-files/proj-123/user-recorded/page-1.mp3',
  'user_recorded',
  'voice-profile-uuid',
  'user-uuid',
  'en'
);


-- SCENARIO 2: Voice cloning - User uploads training samples
-- Step 1: Create voice profile for cloning
INSERT INTO voice_profiles (user_id, profile_name, profile_type, voice_owner, age_at_recording)
VALUES (
  'user-uuid',
  'Emma''s Voice (Age 7)',
  'voice_clone_pending',
  'child',
  7
);

-- Step 2: Upload 30-60s training samples
INSERT INTO voice_training_samples (
  voice_profile_id,
  user_id,
  audio_url,
  audio_filename,
  duration_seconds,
  text_content,
  language
)
VALUES
  ('voice-profile-uuid', 'user-uuid', 'training/sample-1.mp3', 'sample-1.mp3', 45.2,
   'The quick brown fox jumps over the lazy dog. I love reading stories!', 'en'),
  ('voice-profile-uuid', 'user-uuid', 'training/sample-2.mp3', 'sample-2.mp3', 38.5,
   'Once upon a time, in a magical forest, there lived a little rabbit.', 'en');

-- Step 3: Check if ready for training
SELECT is_voice_profile_ready_for_training('voice-profile-uuid'); -- Returns TRUE

-- Step 4: Train voice model (backend job)
-- Your backend calls ElevenLabs/PlayHT API with training samples
-- Once trained:
UPDATE voice_profiles
SET
  profile_type = 'voice_clone_ready',
  ai_provider = 'elevenlabs',
  ai_model_id = 'elevenlabs-voice-id-xyz',
  ai_model_status = 'ready',
  trained_at = NOW()
WHERE id = 'voice-profile-uuid';

-- Step 5: Generate story audio using cloned voice
INSERT INTO story_audio_pages (
  project_id,
  page_number,
  page_type,
  text_content,
  audio_url,
  audio_source,
  voice_profile_id,
  voice_id, -- ElevenLabs voice ID
  language
)
VALUES (
  'project-uuid',
  1,
  'scene',
  'The little rabbit hopped through the forest...',
  'story-audio-files/proj-123/voice-clone/page-1.mp3',
  'ai_voice_clone',
  'voice-profile-uuid',
  'elevenlabs-voice-id-xyz',
  'en'
);


-- QUERY: Get all voice profiles for a user
SELECT
  id,
  profile_name,
  profile_type,
  voice_owner,
  total_training_duration_seconds,
  ai_provider,
  created_at
FROM voice_profiles
WHERE user_id = 'user-uuid'
  AND is_active = TRUE
ORDER BY created_at DESC;


-- QUERY: Get training samples for a voice profile
SELECT
  audio_url,
  duration_seconds,
  text_content,
  quality_score,
  uploaded_at
FROM voice_training_samples
WHERE voice_profile_id = 'voice-profile-uuid'
  AND is_approved = TRUE
ORDER BY uploaded_at ASC;


-- QUERY: Get audio pages by source type
SELECT
  page_number,
  page_type,
  audio_source,
  vp.profile_name AS voice_profile_name,
  audio_url
FROM story_audio_pages sap
LEFT JOIN voice_profiles vp ON sap.voice_profile_id = vp.id
WHERE sap.project_id = 'project-uuid'
  AND sap.language = 'en'
ORDER BY page_number;


-- QUERY: Mixed audio story (some AI TTS, some user-recorded)
SELECT
  page_number,
  page_type,
  text_content,
  audio_source,
  CASE
    WHEN audio_source = 'ai_tts' THEN 'Standard AI Voice'
    WHEN audio_source = 'user_recorded' THEN vp.profile_name
    WHEN audio_source = 'ai_voice_clone' THEN vp.profile_name || ' (AI Clone)'
  END AS voice_description,
  audio_url
FROM story_audio_pages sap
LEFT JOIN voice_profiles vp ON sap.voice_profile_id = vp.id
WHERE project_id = 'project-uuid'
ORDER BY page_number;
*/


-- ============================================
-- 7. Indexes for Performance
-- ============================================

-- Composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_audio_pages_project_lang_source_page
  ON story_audio_pages(project_id, language, audio_source, page_number);

-- Index for voice profile lookups in audio pages
CREATE INDEX IF NOT EXISTS idx_audio_pages_voice_profile_project
  ON story_audio_pages(voice_profile_id, project_id)
  WHERE voice_profile_id IS NOT NULL;


-- ============================================
-- 8. Storage Bucket Structure
-- ============================================

/*
Recommended storage structure in 'story-audio-files' bucket:

story-audio-files/
├── {project_id}/
│   ├── ai-tts/
│   │   ├── page-1-en.mp3
│   │   ├── page-2-en.mp3
│   │   └── page-1-zh.mp3
│   ├── user-recorded/
│   │   ├── page-1-{timestamp}.mp3
│   │   └── page-2-{timestamp}.mp3
│   └── voice-clone/
│       ├── page-1-{timestamp}.mp3
│       └── page-2-{timestamp}.mp3
├── voice-training/
│   └── {voice_profile_id}/
│       ├── sample-1-{timestamp}.mp3
│       ├── sample-2-{timestamp}.mp3
│       └── sample-3-{timestamp}.mp3
└── spotify-compilations/
    └── {project_id}-{timestamp}.mp3

File format: MP3 (universal compatibility)
- Browser MediaRecorder → WebM/OGG → Convert to MP3 server-side
- AI TTS (OpenAI) → Already MP3
- Voice Clone APIs → Usually MP3 output
- Spotify/Podcasts → Requires MP3
*/
