-- Inbound contact leads (career fair sign-ups, partnership inquiries, product
-- interest, etc). One row per submission — same person may submit multiple
-- times across different events/sources, and we keep every touchpoint.
--
-- Companion code:
--   - storyme-app/src/app/(marketing)/contact/page.tsx          (form + OAuth)
--   - storyme-app/src/app/(marketing)/contact/thanks/page.tsx   (post-OAuth finalize)
--   - storyme-app/src/app/api/v1/leads/route.ts                 (POST endpoint)
--   - storyme-app/src/lib/leads/                                (service + repository)
--
-- RLS: enabled, with no public/authenticated policies. The /api/v1/leads
-- endpoint uses the service-role client to insert. No client code should ever
-- read or write this table directly.

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  name                TEXT,
  interest            TEXT NOT NULL CHECK (interest IN
                        ('job', 'school_partnership', 'product_interest', 'other')),
  source              TEXT NOT NULL,
  source_medium       TEXT CHECK (
                        source_medium IS NULL OR
                        source_medium IN ('qr_code', 'web', 'in_person', 'referral')
                      ),
  auth_provider       TEXT CHECK (
                        auth_provider IS NULL OR
                        auth_provider IN ('google', 'apple', 'email')
                      ),
  user_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message             TEXT,
  consent_marketing   BOOLEAN NOT NULL DEFAULT FALSE,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive email lookup (matching leads to later sign-ups, dedup
-- detection in admin views). Not unique — same person may submit repeatedly.
CREATE INDEX IF NOT EXISTS leads_email_idx
  ON leads (LOWER(email));

-- Listing recent leads per campaign/source ("all career-fair-2026-05 leads").
CREATE INDEX IF NOT EXISTS leads_source_created_idx
  ON leads (source, created_at DESC);

-- Listing recent leads by intent ("all school partnership inquiries").
CREATE INDEX IF NOT EXISTS leads_interest_created_idx
  ON leads (interest, created_at DESC);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE leads IS
  'Inbound contact leads from /contact page. Service-role only writes; no client access.';
COMMENT ON COLUMN leads.source IS
  'Free-form slug identifying where the lead came from. Examples: ''career-fair-2026-05'', ''footer'', ''careers-page''. Use kebab-case event slugs with dates.';
COMMENT ON COLUMN leads.source_medium IS
  'How they reached the form: qr_code (scanned at an event), web (clicked a link), in_person (typed in by us), referral.';
COMMENT ON COLUMN leads.interest IS
  'What they want from us. Add new options to the CHECK constraint via migration; route uncommon intents through ''other'' + message in the meantime.';
COMMENT ON COLUMN leads.consent_marketing IS
  'Affirmative consent to receive marketing email. US CAN-SPAM compliant. Do not pre-check for EU/UK traffic if that becomes a concern.';
COMMENT ON COLUMN leads.user_id IS
  'Set when the visitor used OAuth (Google/Apple) and we matched their email to an auth.users row. ON DELETE SET NULL preserves the lead even if the account is later deleted.';
COMMENT ON COLUMN leads.metadata IS
  'Escape hatch for event-specific data (booth number, recruiter notes, etc) without schema migrations.';
