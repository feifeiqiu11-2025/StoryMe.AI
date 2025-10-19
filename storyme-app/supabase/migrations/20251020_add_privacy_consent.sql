-- ============================================
-- Privacy Consent Tracking
-- Adds consent tracking to users table for GDPR/privacy compliance
-- ============================================

-- Add privacy consent fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_given BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_date TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_version VARCHAR(10) DEFAULT '1.0';
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_date TIMESTAMPTZ;

-- Add comments for documentation
COMMENT ON COLUMN users.privacy_consent_given IS 'User has consented to privacy policy';
COMMENT ON COLUMN users.privacy_consent_date IS 'When user gave privacy consent';
COMMENT ON COLUMN users.privacy_consent_version IS 'Version of privacy policy user consented to';
COMMENT ON COLUMN users.terms_accepted IS 'User has accepted terms of service';
COMMENT ON COLUMN users.terms_accepted_date IS 'When user accepted terms';

-- Index for querying consent status
CREATE INDEX IF NOT EXISTS idx_users_privacy_consent ON users(privacy_consent_given, privacy_consent_date);
