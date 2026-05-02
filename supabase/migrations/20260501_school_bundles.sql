-- School Bundle support: 4-teacher team subscriptions with shared billing
-- Phase 1: align team-tier limit with webhook, add Stripe linkage to teams,
--          add Checkout Session state tracking
--
-- Companion code:
--   - storyme-app/src/app/api/webhooks/stripe/route.ts (team_id fan-out)
--   - storyme-app/src/app/api/admin/school-bundles/*
--   - storyme-app/src/app/(dashboard)/admin/school-bundles/page.tsx

-- ─────────────────────────────────────────────────────────────────────────
-- 1. Fix sync_team_member_to_user trigger: stories_limit -1 → 15
-- ─────────────────────────────────────────────────────────────────────────
-- Previously the trigger set stories_limit = -1 (unlimited) on team-member
-- accept, which contradicted the Stripe webhook (which sets 15). Align with
-- webhook so school bundle = 4 accounts × 15 stories each.

CREATE OR REPLACE FUNCTION sync_team_member_to_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invitation_status = 'accepted' AND NEW.user_id IS NOT NULL THEN
    UPDATE users
    SET
      team_id = NEW.team_id,
      is_team_primary = NEW.is_primary,
      subscription_tier = 'team',
      subscription_status = 'active',
      stories_limit = 15
    WHERE id = NEW.user_id;

    NEW.joined_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Backfill any existing team users still at -1
UPDATE users
SET stories_limit = 15
WHERE subscription_tier = 'team' AND stories_limit = -1;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. Extend teams table for school bundle billing
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS subscription_status TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN DEFAULT FALSE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS tax_exempt_note TEXT;

-- Checkout Session lifecycle (Stripe sessions expire; max 30 days)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS checkout_session_id TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS checkout_url TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS checkout_expires_at TIMESTAMPTZ;

-- Allowed bundle states:
--   'pending'           — created, Checkout not completed
--   'checkout_expired'  — Checkout link expired without payment (regenerate)
--   'incomplete'        — Stripe processing first payment
--   'active'            — paying, all 4 members have access
--   'past_due'          — payment failed, in dunning grace period
--   'cancelled'         — subscription ended
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_subscription_status_check;
ALTER TABLE teams ADD CONSTRAINT teams_subscription_status_check
  CHECK (subscription_status IS NULL OR subscription_status IN (
    'pending', 'checkout_expired', 'incomplete', 'active', 'past_due', 'cancelled'
  ));

CREATE INDEX IF NOT EXISTS idx_teams_stripe_customer_id ON teams(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_teams_stripe_subscription_id ON teams(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_teams_subscription_status ON teams(subscription_status);

COMMENT ON COLUMN teams.stripe_customer_id IS 'Stripe Customer for school primary teacher / billing contact';
COMMENT ON COLUMN teams.stripe_subscription_id IS 'Stripe Subscription for recurring school bundle billing';
COMMENT ON COLUMN teams.subscription_status IS 'Bundle status: pending -> active via Checkout; cancelled when school ends sub';
COMMENT ON COLUMN teams.current_period_end IS 'Next bill date, mirrored from Stripe';
COMMENT ON COLUMN teams.cancel_at_period_end IS 'School cancelled but still in paid period';
COMMENT ON COLUMN teams.tax_exempt IS 'School provided tax exemption certificate';
COMMENT ON COLUMN teams.tax_exempt_note IS 'Exemption details (cert ID, jurisdiction, etc.)';
COMMENT ON COLUMN teams.checkout_session_id IS 'Stripe Checkout Session for initial card collection';
COMMENT ON COLUMN teams.checkout_url IS 'Hosted Checkout URL to send to school primary';
COMMENT ON COLUMN teams.checkout_expires_at IS 'When Checkout link stops working (max 30 days from creation)';
