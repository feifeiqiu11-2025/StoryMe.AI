-- Add welcome_email_sent_at column for tracking welcome email delivery
ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ;
