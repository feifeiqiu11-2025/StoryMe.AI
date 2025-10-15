-- ============================================
-- Guest Session & Analytics Tracking
-- Run this after database-schema.sql
-- ============================================

-- ============================================
-- GUEST SESSIONS (Anonymous usage tracking)
-- ============================================

CREATE TABLE guest_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Session Identification
  session_token VARCHAR(255) UNIQUE NOT NULL, -- Anonymous session ID stored in cookie
  fingerprint_hash VARCHAR(255), -- Browser fingerprint for analytics

  -- Session Metadata
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  landing_page TEXT,

  -- Geo data (optional, can be enriched later)
  country VARCHAR(2),
  region VARCHAR(100),
  city VARCHAR(100),

  -- Timing
  first_seen_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP DEFAULT NOW(),
  session_duration_seconds INTEGER DEFAULT 0,

  -- Conversion tracking
  converted_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  converted_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_guest_sessions_token ON guest_sessions(session_token);
CREATE INDEX idx_guest_sessions_converted ON guest_sessions(converted_to_user_id);
CREATE INDEX idx_guest_sessions_created ON guest_sessions(created_at);

-- ============================================
-- PAGE VIEWS (Track user navigation)
-- ============================================

CREATE TABLE page_views (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Association
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,

  -- Page Info
  page_path VARCHAR(500) NOT NULL,
  page_title VARCHAR(255),
  referrer TEXT,

  -- Timing
  view_duration_seconds INTEGER,
  viewed_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT user_or_guest_check CHECK (
    (user_id IS NOT NULL AND guest_session_id IS NULL) OR
    (user_id IS NULL AND guest_session_id IS NOT NULL)
  )
);

CREATE INDEX idx_page_views_user ON page_views(user_id);
CREATE INDEX idx_page_views_guest ON page_views(guest_session_id);
CREATE INDEX idx_page_views_path ON page_views(page_path);
CREATE INDEX idx_page_views_viewed_at ON page_views(viewed_at);

-- ============================================
-- EVENTS (Track user actions)
-- ============================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Association
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,

  -- Event Info
  event_name VARCHAR(100) NOT NULL, -- e.g., "character_created", "story_generated", "pdf_attempted"
  event_category VARCHAR(50), -- e.g., "engagement", "conversion", "error"
  event_properties JSONB, -- Additional event data

  -- Context
  page_path VARCHAR(500),

  occurred_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT user_or_guest_event_check CHECK (
    (user_id IS NOT NULL AND guest_session_id IS NULL) OR
    (user_id IS NULL AND guest_session_id IS NOT NULL)
  )
);

CREATE INDEX idx_events_user ON events(user_id);
CREATE INDEX idx_events_guest ON events(guest_session_id);
CREATE INDEX idx_events_name ON events(event_name);
CREATE INDEX idx_events_category ON events(event_category);
CREATE INDEX idx_events_occurred_at ON events(occurred_at);

-- ============================================
-- GUEST PROJECTS (Temporary projects for guests)
-- ============================================

-- Allow projects without user_id for guest access
ALTER TABLE projects
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_or_guest_project_check CHECK (
    (user_id IS NOT NULL AND guest_session_id IS NULL) OR
    (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE INDEX idx_projects_guest_session ON projects(guest_session_id);

-- ============================================
-- GUEST CHARACTERS (Temporary characters for guests)
-- ============================================

-- Allow character_library without user_id for guest access
ALTER TABLE character_library
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  ADD CONSTRAINT user_or_guest_character_check CHECK (
    (user_id IS NOT NULL AND guest_session_id IS NULL) OR
    (user_id IS NULL AND guest_session_id IS NOT NULL)
  );

CREATE INDEX idx_character_library_guest_session ON character_library(guest_session_id);

-- ============================================
-- ANALYTICS VIEWS (For dashboards and reports)
-- ============================================

-- Daily active users (including guests)
CREATE VIEW daily_active_users AS
SELECT
  DATE(viewed_at) as date,
  COUNT(DISTINCT user_id) as registered_users,
  COUNT(DISTINCT guest_session_id) as guest_users,
  COUNT(DISTINCT COALESCE(user_id::TEXT, guest_session_id::TEXT)) as total_unique_users
FROM page_views
GROUP BY DATE(viewed_at)
ORDER BY date DESC;

-- Conversion funnel
CREATE VIEW conversion_funnel AS
SELECT
  'Total Visitors' as stage,
  COUNT(DISTINCT id) as count,
  1 as step_order
FROM guest_sessions
UNION ALL
SELECT
  'Created Character' as stage,
  COUNT(DISTINCT guest_session_id) as count,
  2 as step_order
FROM character_library
WHERE guest_session_id IS NOT NULL
UNION ALL
SELECT
  'Started Project' as stage,
  COUNT(DISTINCT guest_session_id) as count,
  3 as step_order
FROM projects
WHERE guest_session_id IS NOT NULL
UNION ALL
SELECT
  'Converted to User' as stage,
  COUNT(DISTINCT id) as count,
  4 as step_order
FROM guest_sessions
WHERE converted_to_user_id IS NOT NULL
ORDER BY step_order;

-- Popular pages
CREATE VIEW popular_pages AS
SELECT
  page_path,
  COUNT(*) as total_views,
  COUNT(DISTINCT user_id) as unique_registered_users,
  COUNT(DISTINCT guest_session_id) as unique_guests,
  AVG(view_duration_seconds) as avg_duration_seconds
FROM page_views
WHERE viewed_at > NOW() - INTERVAL '30 days'
GROUP BY page_path
ORDER BY total_views DESC;

-- Event summary
CREATE VIEW event_summary AS
SELECT
  event_name,
  event_category,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_registered_users,
  COUNT(DISTINCT guest_session_id) as unique_guests,
  DATE(occurred_at) as date
FROM events
WHERE occurred_at > NOW() - INTERVAL '30 days'
GROUP BY event_name, event_category, DATE(occurred_at)
ORDER BY date DESC, total_events DESC;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to update last_seen_at for guest sessions
CREATE OR REPLACE FUNCTION update_guest_session_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE guest_sessions
  SET
    last_seen_at = NOW(),
    session_duration_seconds = EXTRACT(EPOCH FROM (NOW() - first_seen_at))::INTEGER
  WHERE id = NEW.guest_session_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update guest session when page view recorded
CREATE TRIGGER update_guest_last_seen_trigger
AFTER INSERT ON page_views
FOR EACH ROW
WHEN (NEW.guest_session_id IS NOT NULL)
EXECUTE FUNCTION update_guest_session_last_seen();

-- ============================================
-- RLS POLICIES FOR GUEST ACCESS
-- ============================================

-- Note: Guest data should be accessible only by session token
-- Implement in application layer, not RLS (since guests aren't authenticated users)

-- Projects: Allow guests to access their own projects via session
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own projects"
  ON projects FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON projects FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON projects FOR DELETE
  USING (auth.uid() = user_id);

-- Note: Guest project access handled in application layer via session tokens

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE guest_sessions IS 'Anonymous user sessions for tracking engagement before registration';
COMMENT ON TABLE page_views IS 'Track page navigation for both registered users and guests';
COMMENT ON TABLE events IS 'Track specific user actions and events for analytics';
COMMENT ON COLUMN guest_sessions.session_token IS 'Unique token stored in cookie to identify guest sessions';
COMMENT ON COLUMN guest_sessions.converted_to_user_id IS 'Links guest session to registered user after signup';
COMMENT ON VIEW conversion_funnel IS 'Shows conversion rates from visitor to registered user';
