-- ============================================
-- User Feedback System
-- Collects user ratings and feedback after first story save
-- Powers testimonials on landing page
-- ============================================

-- Create user_feedback table
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,

  -- Feedback content
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text TEXT,

  -- Display settings
  display_name VARCHAR(100), -- e.g., "Sarah M."
  is_public BOOLEAN DEFAULT false, -- User consents to public display
  is_featured BOOLEAN DEFAULT false, -- Admin can feature testimonials

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT user_feedback_user_unique UNIQUE (user_id) -- One feedback per user
);

-- Add index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_feedback_user_id ON user_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_user_feedback_rating ON user_feedback(rating DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_public ON user_feedback(is_public, rating DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_featured ON user_feedback(is_featured, rating DESC);

-- Add comment for documentation
COMMENT ON TABLE user_feedback IS 'User feedback and ratings collected after first story creation';
COMMENT ON COLUMN user_feedback.rating IS 'Star rating 1-5';
COMMENT ON COLUMN user_feedback.feedback_text IS 'Optional text feedback (500 char max on client)';
COMMENT ON COLUMN user_feedback.display_name IS 'Name to show publicly (e.g., "Sarah M.")';
COMMENT ON COLUMN user_feedback.is_public IS 'User consents to public testimonial display';
COMMENT ON COLUMN user_feedback.is_featured IS 'Admin-selected featured testimonial';

-- Row Level Security (RLS) Policies
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Users can read their own feedback
CREATE POLICY "Users can read own feedback"
  ON user_feedback
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own feedback (one time only)
CREATE POLICY "Users can insert own feedback"
  ON user_feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update own feedback"
  ON user_feedback
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read public feedback (for testimonials)
CREATE POLICY "Anyone can read public feedback"
  ON user_feedback
  FOR SELECT
  USING (is_public = true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_feedback_timestamp
  BEFORE UPDATE ON user_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_user_feedback_updated_at();

-- Add column to users table to track if feedback has been given
ALTER TABLE users ADD COLUMN IF NOT EXISTS has_given_feedback BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS feedback_bonus_awarded BOOLEAN DEFAULT false;

COMMENT ON COLUMN users.has_given_feedback IS 'True if user has submitted feedback';
COMMENT ON COLUMN users.feedback_bonus_awarded IS 'True if user received +5 bonus images for feedback';
