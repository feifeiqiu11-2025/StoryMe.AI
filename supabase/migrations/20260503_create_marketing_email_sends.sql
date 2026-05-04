-- Idempotency log for marketing email broadcasts.
--
-- Each row represents one delivered (or failed) send to one recipient under
-- one campaign. The UNIQUE index on (campaign_id, LOWER(email)) prevents the
-- broadcast endpoint from ever sending the same campaign to the same email
-- twice — even if the endpoint is invoked multiple times to chunk through the
-- recipient list.
--
-- Companion code:
--   - storyme-app/src/app/api/admin/send-marketing-email/route.ts
--   - storyme-app/src/lib/email/spark-letter-1.ts
--
-- RLS: enabled, but no public/authenticated policies are created. The admin
-- broadcast endpoint uses the service-role client, which bypasses RLS by
-- design. No client code should ever read or write this table directly.

CREATE TABLE IF NOT EXISTS marketing_email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id TEXT NOT NULL,
  email TEXT NOT NULL,
  user_id UUID,
  resend_message_id TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  error TEXT
);

-- The idempotency guarantee. LOWER(email) so case-insensitive duplicates are
-- caught (User@Example.com vs user@example.com).
CREATE UNIQUE INDEX IF NOT EXISTS marketing_email_sends_campaign_email_idx
  ON marketing_email_sends (campaign_id, LOWER(email));

-- For listing recent sends in admin dashboards.
CREATE INDEX IF NOT EXISTS marketing_email_sends_campaign_sent_at_idx
  ON marketing_email_sends (campaign_id, sent_at DESC);

ALTER TABLE marketing_email_sends ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE marketing_email_sends IS 'Idempotency log for marketing email broadcasts. UNIQUE (campaign_id, LOWER(email)) prevents duplicate sends across re-runs of the broadcast endpoint.';
COMMENT ON COLUMN marketing_email_sends.campaign_id IS 'Identifier of the broadcast campaign (e.g. ''spark-letter-1''). Test sends use a ''-test'' suffix so live sends are not skipped.';
COMMENT ON COLUMN marketing_email_sends.email IS 'Recipient email at time of send (lowercased for the unique index, but preserved as-sent for audit).';
COMMENT ON COLUMN marketing_email_sends.user_id IS 'Optional auth.users.id snapshot. No FK so deleting a user does not cascade and erase send history.';
COMMENT ON COLUMN marketing_email_sends.resend_message_id IS 'Resend API message ID returned on successful send. Use to correlate with Resend dashboard webhooks (delivered, opened, clicked, bounced, complained).';
COMMENT ON COLUMN marketing_email_sends.status IS 'sent | failed. Failed rows still occupy the unique slot so the endpoint will not retry them automatically — manual retry requires deleting the failed row.';
COMMENT ON COLUMN marketing_email_sends.error IS 'On status=failed, the error message returned by Resend or thrown locally.';
