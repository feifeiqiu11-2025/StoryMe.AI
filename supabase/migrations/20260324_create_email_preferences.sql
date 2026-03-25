-- Create email_preferences table for marketing email opt-out
-- Keyed by email (not user ID) to support both registered users and workshop-only parents

CREATE TABLE IF NOT EXISTS email_preferences (
  email TEXT PRIMARY KEY,
  marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_opt_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partial index for efficient filtering of opted-in users during email sends
CREATE INDEX IF NOT EXISTS idx_email_prefs_opted_in
  ON email_preferences(email) WHERE marketing_opt_out = FALSE;

COMMENT ON TABLE email_preferences IS 'Stores email marketing preferences, keyed by email address';
COMMENT ON COLUMN email_preferences.marketing_opt_out IS 'Whether this email has opted out of marketing emails';
COMMENT ON COLUMN email_preferences.marketing_opt_out_at IS 'Timestamp when opt-out occurred';
