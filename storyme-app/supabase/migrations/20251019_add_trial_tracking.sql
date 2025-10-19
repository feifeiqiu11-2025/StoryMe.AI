-- ============================================
-- Trial & Image Usage Tracking Migration
-- ============================================

-- Add trial and image tracking fields to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS images_generated_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS images_limit INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS trial_status VARCHAR(50) DEFAULT 'active';

-- Create indexes for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_trial_status ON users(trial_status);
CREATE INDEX IF NOT EXISTS idx_users_trial_ends_at ON users(trial_ends_at);

-- Function to track image generation
CREATE OR REPLACE FUNCTION track_image_generation()
RETURNS TRIGGER AS $$
DECLARE
  project_user_id UUID;
  is_regeneration BOOLEAN;
BEGIN
  -- Get the user_id from the project
  SELECT user_id INTO project_user_id
  FROM projects
  WHERE id = NEW.project_id;

  -- Check if this is a regeneration (more than 1 image for this scene)
  SELECT COUNT(*) > 1 INTO is_regeneration
  FROM generated_images
  WHERE scene_id = NEW.scene_id;

  -- Increment user's image count
  UPDATE users
  SET images_generated_count = images_generated_count + 1
  WHERE id = project_user_id;

  -- Log the usage
  INSERT INTO usage_logs (user_id, action_type, resource_id, metadata)
  VALUES (
    project_user_id,
    'image_generated',
    NEW.id,
    jsonb_build_object(
      'scene_id', NEW.scene_id,
      'project_id', NEW.project_id,
      'is_regeneration', is_regeneration,
      'model_used', NEW.model_used,
      'cost_usd', NEW.cost_usd
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on image generation
DROP TRIGGER IF EXISTS trigger_track_image_generation ON generated_images;
CREATE TRIGGER trigger_track_image_generation
AFTER INSERT ON generated_images
FOR EACH ROW
EXECUTE FUNCTION track_image_generation();

-- Function to check if user has exceeded limit
CREATE OR REPLACE FUNCTION check_image_limit(user_uuid UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  count INTEGER,
  limit_val INTEGER,
  remaining INTEGER,
  trial_expired BOOLEAN
) AS $$
DECLARE
  user_record RECORD;
BEGIN
  SELECT
    images_generated_count,
    images_limit,
    subscription_tier,
    trial_ends_at,
    trial_status
  INTO user_record
  FROM users
  WHERE id = user_uuid;

  -- If user not found
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, 0, 0, false;
    RETURN;
  END IF;

  -- Premium users have unlimited
  IF user_record.subscription_tier = 'premium' THEN
    RETURN QUERY SELECT
      true,
      user_record.images_generated_count,
      -1, -- -1 means unlimited
      -1,
      false;
    RETURN;
  END IF;

  -- Check if trial has expired
  IF user_record.trial_ends_at IS NOT NULL
     AND user_record.trial_ends_at < NOW()
     AND user_record.trial_status = 'active' THEN
    RETURN QUERY SELECT
      false,
      user_record.images_generated_count,
      user_record.images_limit,
      0,
      true;
    RETURN;
  END IF;

  -- Check if under limit
  RETURN QUERY SELECT
    (user_record.images_generated_count < user_record.images_limit),
    user_record.images_generated_count,
    user_record.images_limit,
    GREATEST(0, user_record.images_limit - user_record.images_generated_count),
    false;
END;
$$ LANGUAGE plpgsql;

-- View to see user usage statistics
CREATE OR REPLACE VIEW user_usage_stats AS
SELECT
  u.id,
  u.email,
  u.name,
  u.subscription_tier,
  u.trial_status,
  u.trial_started_at,
  u.trial_ends_at,
  u.images_generated_count,
  u.images_limit,
  (u.images_limit - u.images_generated_count) as images_remaining,
  CASE
    WHEN u.subscription_tier = 'premium' THEN 100
    WHEN u.images_limit > 0 THEN ROUND((u.images_generated_count::DECIMAL / u.images_limit) * 100, 2)
    ELSE 0
  END as usage_percentage,
  COUNT(DISTINCT p.id) as total_projects,
  COUNT(DISTINCT gi.id) as total_images,
  COUNT(DISTINCT CASE WHEN ul.metadata->>'is_regeneration' = 'true' THEN ul.id END) as regeneration_count
FROM users u
LEFT JOIN projects p ON u.id = p.user_id
LEFT JOIN generated_images gi ON p.id = gi.project_id
LEFT JOIN usage_logs ul ON u.id = ul.user_id AND ul.action_type = 'image_generated'
GROUP BY u.id, u.email, u.name, u.subscription_tier, u.trial_status,
         u.trial_started_at, u.trial_ends_at, u.images_generated_count, u.images_limit;

-- Update existing users to have trial fields set
UPDATE users
SET
  trial_started_at = COALESCE(trial_started_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '7 days'),
  images_generated_count = COALESCE(images_generated_count, 0),
  images_limit = COALESCE(images_limit, 50),
  trial_status = COALESCE(trial_status, 'active')
WHERE trial_started_at IS NULL;
