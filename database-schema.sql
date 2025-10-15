-- ============================================
-- StoryMe Database Schema (with Character Library)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  subscription_tier VARCHAR(50) DEFAULT 'free', -- free, premium
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CHARACTER LIBRARY (Global, reusable characters)
-- ============================================

CREATE TABLE character_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Basic Info
  name VARCHAR(255) NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0, -- Track how many times used

  -- Reference Images
  reference_image_url TEXT,
  reference_image_filename VARCHAR(255),

  -- Description Fields (user input)
  hair_color VARCHAR(100),
  skin_tone VARCHAR(100),
  clothing TEXT,
  age VARCHAR(50),
  other_features TEXT,
  personality_traits TEXT[], -- Array of traits

  -- AI Generated Data
  ai_description TEXT, -- Full AI-generated description
  character_embedding JSONB, -- Vector embedding for consistency
  reference_images JSONB, -- Array of reference poses {url, pose, embedding}[]

  -- Advanced (Premium Features)
  lora_url TEXT, -- LoRA model URL if trained
  lora_trained_at TIMESTAMP,
  art_style_preference VARCHAR(100), -- 'cartoon', 'watercolor', 'realistic'

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Indexes
  INDEX idx_character_library_user_id (user_id),
  INDEX idx_character_library_name (name)
);

-- ============================================
-- PROJECTS (Story Sessions)
-- ============================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  title VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'draft', -- draft, processing, completed, error

  -- Story Content
  original_script TEXT, -- Original story from user
  simplified_script TEXT, -- AI-simplified version
  reading_level VARCHAR(50), -- pre-k, kindergarten, grade-1

  -- Media
  video_url TEXT, -- If user uploaded video
  transcription TEXT, -- From Whisper

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_projects_user_id (user_id),
  INDEX idx_projects_status (status)
);

-- ============================================
-- PROJECT_CHARACTERS (Link characters to projects)
-- Many-to-Many relationship with additional metadata
-- ============================================

CREATE TABLE project_characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  character_library_id UUID REFERENCES character_library(id) ON DELETE CASCADE,

  -- Project-specific settings
  is_primary BOOLEAN DEFAULT false, -- Primary character for this story
  order_index INTEGER, -- Display order in this project
  role VARCHAR(100), -- 'protagonist', 'friend', 'helper', 'antagonist'

  -- Override settings (optional - defaults to library character)
  override_clothing TEXT, -- Different outfit for this story
  override_age VARCHAR(50), -- Different age for this story
  override_description TEXT, -- Custom description for this story only

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(project_id, character_library_id), -- Same character can't be added twice
  INDEX idx_project_characters_project_id (project_id),
  INDEX idx_project_characters_library_id (character_library_id)
);

-- ============================================
-- SCENES
-- ============================================

CREATE TABLE scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

  scene_number INTEGER NOT NULL,
  description TEXT NOT NULL, -- Original scene description
  simplified_text TEXT, -- AI simplified for reading level

  -- Characters in this scene (array of project_character IDs)
  character_ids UUID[],

  -- Scene metadata
  location_type VARCHAR(100), -- 'playground', 'bedroom', 'forest', etc.
  location_description TEXT, -- Detailed setting for consistency
  time_of_day VARCHAR(50), -- 'morning', 'afternoon', 'night'

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_scenes_project_id (project_id),
  INDEX idx_scenes_scene_number (project_id, scene_number)
);

-- ============================================
-- GENERATED IMAGES
-- ============================================

CREATE TABLE generated_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id),

  -- Image Data
  image_url TEXT NOT NULL,
  image_filename VARCHAR(255),
  thumbnail_url TEXT,

  -- Generation Metadata
  prompt TEXT, -- Full prompt used
  negative_prompt TEXT,
  generation_time FLOAT, -- Seconds
  fal_request_id VARCHAR(255),
  model_used VARCHAR(100), -- 'flux-general', 'flux-lora', etc.

  -- Status
  status VARCHAR(50) DEFAULT 'completed', -- pending, completed, failed
  error_message TEXT,

  -- Cost Tracking
  cost_usd DECIMAL(10, 4),

  -- Overall Scene Ratings (1-5 stars)
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),
  scene_match_score INTEGER CHECK (scene_match_score >= 1 AND scene_match_score <= 5),
  user_expectation_score INTEGER CHECK (user_expectation_score >= 1 AND user_expectation_score <= 5),
  rating_feedback TEXT, -- Optional user comment
  rated_at TIMESTAMP, -- When the rating was submitted

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_generated_images_project_id (project_id),
  INDEX idx_generated_images_scene_id (scene_id),
  INDEX idx_generated_images_overall_rating (overall_rating)
);

-- ============================================
-- CHARACTER RATINGS (Consistency Tracking)
-- ============================================

CREATE TABLE character_ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generated_image_id UUID REFERENCES generated_images(id) ON DELETE CASCADE,
  character_library_id UUID REFERENCES character_library(id), -- Link to library character

  rating VARCHAR(10), -- 'good', 'poor'
  user_id UUID REFERENCES users(id),

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_character_ratings_image_id (generated_image_id),
  INDEX idx_character_ratings_character_id (character_library_id)
);

-- ============================================
-- STORYBOOKS (Finalized Products)
-- ============================================

CREATE TABLE storybooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  -- Book Info
  title VARCHAR(255),
  author_name VARCHAR(255), -- Child's name as author
  dedication TEXT,

  -- Files
  pdf_url TEXT,
  cover_image_url TEXT,

  -- Metadata
  page_count INTEGER,
  reading_level VARCHAR(50),
  art_style VARCHAR(100),

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  share_token VARCHAR(100) UNIQUE, -- For sharing links
  view_count INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_storybooks_user_id (user_id),
  INDEX idx_storybooks_share_token (share_token)
);

-- ============================================
-- VIDEOS (Phase 2)
-- ============================================

CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  storybook_id UUID REFERENCES storybooks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),

  -- Video Data
  video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER,

  -- Audio Settings
  narration_voice VARCHAR(100), -- 'nova', 'alloy', 'echo', etc.
  speech_speed FLOAT DEFAULT 0.9,
  has_background_music BOOLEAN DEFAULT false,
  music_track VARCHAR(100),

  -- Animation Settings
  animation_style VARCHAR(50), -- 'pan-zoom', 'character-animation'

  -- Status
  status VARCHAR(50) DEFAULT 'processing', -- processing, completed, failed
  error_message TEXT,

  -- Cost Tracking
  cost_usd DECIMAL(10, 4),

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_videos_storybook_id (storybook_id)
);

-- ============================================
-- SUBSCRIPTIONS
-- ============================================

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  tier VARCHAR(50) NOT NULL, -- free, premium
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Status
  status VARCHAR(50), -- active, canceled, past_due, trialing
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Billing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_subscriptions_user_id (user_id),
  INDEX idx_subscriptions_stripe_id (stripe_subscription_id)
);

-- ============================================
-- USAGE LOGS (Analytics & Rate Limiting)
-- ============================================

CREATE TABLE usage_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),

  action_type VARCHAR(100), -- 'story_created', 'image_generated', 'video_created', etc.
  resource_id UUID, -- ID of project, image, video, etc.

  -- Cost Tracking
  cost_usd DECIMAL(10, 4),

  -- Metadata (flexible JSON for different action types)
  metadata JSONB,

  created_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_usage_logs_user_id (user_id),
  INDEX idx_usage_logs_created_at (created_at),
  INDEX idx_usage_logs_action_type (action_type)
);

-- ============================================
-- CHARACTER LIBRARY TAGS (Optional - for organization)
-- ============================================

CREATE TABLE character_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7), -- Hex color for UI

  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(user_id, name)
);

CREATE TABLE character_library_tags (
  character_library_id UUID REFERENCES character_library(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES character_tags(id) ON DELETE CASCADE,

  PRIMARY KEY (character_library_id, tag_id)
);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: Character consistency scores
CREATE VIEW character_consistency_scores AS
SELECT
  cl.id as character_id,
  cl.name,
  cl.user_id,
  COUNT(cr.id) as total_ratings,
  SUM(CASE WHEN cr.rating = 'good' THEN 1 ELSE 0 END) as good_ratings,
  ROUND(
    (SUM(CASE WHEN cr.rating = 'good' THEN 1 ELSE 0 END)::FLOAT /
     NULLIF(COUNT(cr.id), 0)) * 100,
    2
  ) as consistency_percentage
FROM character_library cl
LEFT JOIN character_ratings cr ON cl.id = cr.character_library_id
GROUP BY cl.id, cl.name, cl.user_id;

-- View: User project summary
CREATE VIEW user_project_summary AS
SELECT
  u.id as user_id,
  u.email,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT CASE WHEN p.status = 'completed' THEN p.id END) as completed_projects,
  COUNT(DISTINCT sb.id) as total_storybooks,
  COUNT(DISTINCT v.id) as total_videos
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN storybooks sb ON u.id = sb.user_id
LEFT JOIN videos v ON u.id = v.user_id
GROUP BY u.id, u.email;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function: Increment character usage count
CREATE OR REPLACE FUNCTION increment_character_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE character_library
  SET usage_count = usage_count + 1
  WHERE id = NEW.character_library_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_character_usage
AFTER INSERT ON project_characters
FOR EACH ROW
EXECUTE FUNCTION increment_character_usage();

-- Function: Update project timestamp on scene changes
CREATE OR REPLACE FUNCTION update_project_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE projects
  SET updated_at = NOW()
  WHERE id = NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_on_scene
AFTER INSERT OR UPDATE ON scenes
FOR EACH ROW
EXECUTE FUNCTION update_project_timestamp();
