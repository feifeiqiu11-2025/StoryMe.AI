-- Migration: Add story audio pages for Reading Mode
-- This table stores audio files for each page of the storybook

-- Create story_audio_pages table
CREATE TABLE IF NOT EXISTS story_audio_pages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  page_number INT NOT NULL,
  page_type VARCHAR(20) NOT NULL CHECK (page_type IN ('cover', 'scene')),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,

  -- Audio data
  text_content TEXT NOT NULL,
  audio_url TEXT,
  audio_filename TEXT,
  audio_duration_seconds NUMERIC(6,2),

  -- Generation metadata
  voice_id VARCHAR(100),
  tone VARCHAR(50),
  generation_status VARCHAR(20) DEFAULT 'pending' CHECK (generation_status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(project_id, page_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_story_audio_pages_project ON story_audio_pages(project_id);
CREATE INDEX IF NOT EXISTS idx_story_audio_pages_status ON story_audio_pages(generation_status);

-- Add RLS (Row Level Security) policies
ALTER TABLE story_audio_pages ENABLE ROW LEVEL SECURITY;

-- Users can view their own audio pages
CREATE POLICY "Users can view their own audio pages" ON story_audio_pages
  FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can insert their own audio pages
CREATE POLICY "Users can insert their own audio pages" ON story_audio_pages
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can update their own audio pages
CREATE POLICY "Users can update their own audio pages" ON story_audio_pages
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can delete their own audio pages
CREATE POLICY "Users can delete their own audio pages" ON story_audio_pages
  FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_story_audio_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_story_audio_pages_updated_at_trigger
  BEFORE UPDATE ON story_audio_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_story_audio_pages_updated_at();

-- Storage bucket for audio files will be created via Supabase Dashboard or with:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('story-audio-files', 'story-audio-files', true);

COMMENT ON TABLE story_audio_pages IS 'Stores audio narration files for each page of a storybook';
COMMENT ON COLUMN story_audio_pages.page_type IS 'Type of page: cover or scene';
COMMENT ON COLUMN story_audio_pages.text_content IS 'The text that was converted to audio';
COMMENT ON COLUMN story_audio_pages.audio_url IS 'URL to the audio file in Supabase storage';
COMMENT ON COLUMN story_audio_pages.voice_id IS 'OpenAI TTS voice used (nova, shimmer, echo, etc.)';
COMMENT ON COLUMN story_audio_pages.tone IS 'Story tone used to select voice (playful, educational, etc.)';
