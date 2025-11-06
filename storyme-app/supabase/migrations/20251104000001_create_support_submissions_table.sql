-- Support Submissions Feature
-- Creates table for user support requests and feedback
-- Admin-only viewing restricted to feifei_qiu@hotmail.com

-- ============================================
-- 1. SUPPORT SUBMISSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS support_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Submission Info
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  submission_type TEXT DEFAULT 'issue' CHECK (submission_type IN ('issue', 'feedback', 'question', 'other')),

  -- User Info (optional - can be submitted by anonymous users)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT,
  user_name TEXT,

  -- Status & Admin Review
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),

  -- Admin Notes
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  user_agent TEXT,
  referrer_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_support_submissions_user ON support_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_support_submissions_status ON support_submissions(status);
CREATE INDEX IF NOT EXISTS idx_support_submissions_created ON support_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_submissions_type ON support_submissions(submission_type);

-- ============================================
-- 3. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_support_submission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_support_submissions_updated_at ON support_submissions;
CREATE TRIGGER trigger_support_submissions_updated_at
BEFORE UPDATE ON support_submissions
FOR EACH ROW EXECUTE FUNCTION update_support_submission_updated_at();

-- ============================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on support_submissions table
ALTER TABLE support_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert support submissions (including anonymous users)
DROP POLICY IF EXISTS support_submissions_insert_public ON support_submissions;
CREATE POLICY support_submissions_insert_public ON support_submissions
  FOR INSERT WITH CHECK (true);

-- Policy: Users can view their own submissions
DROP POLICY IF EXISTS support_submissions_own_access ON support_submissions;
CREATE POLICY support_submissions_own_access ON support_submissions
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Admin (feifei_qiu@hotmail.com) can view and manage all submissions
DROP POLICY IF EXISTS support_submissions_admin_access ON support_submissions;
CREATE POLICY support_submissions_admin_access ON support_submissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email = 'feifei_qiu@hotmail.com'
    )
  );

-- ============================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON TABLE support_submissions IS 'User support requests, issues, and feedback submissions';
COMMENT ON COLUMN support_submissions.status IS 'new: unreviewed, in_progress: being worked on, resolved: fixed, closed: completed';
COMMENT ON COLUMN support_submissions.user_id IS 'Optional - allows anonymous submissions';
