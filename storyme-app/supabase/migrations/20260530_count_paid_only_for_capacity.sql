-- Migration: Count PAID registrations only for capacity enforcement
-- Date: 2026-05-30
-- Description: Drops the 30-minute pending-grace branch from v1/v2/v3 of
--              get_workshop_registration_counts. The grace was meant to
--              hold a slot during a parent's Stripe checkout, but in
--              practice it lets abandoned/duplicate checkout attempts
--              block real signups (e.g. one parent retrying checkout 3x
--              within 30 min consumes 3 slots until expiry). With Stripe
--              webhooks flipping `payment_status` to 'paid' on completion
--              and our low workshop volume, double-booking is preferable
--              to false "fully booked" errors. Refunds can clean up the
--              rare race-condition over-sale.

-- ----- v1: partner + session_type ---------------------------------------

CREATE OR REPLACE FUNCTION get_workshop_registration_counts(
  p_partner_id TEXT,
  p_session_type TEXT
)
RETURNS TABLE(workshop_id TEXT, registration_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    unnest(wr.selected_workshop_ids) AS workshop_id,
    COUNT(*) AS registration_count
  FROM workshop_registrations wr
  WHERE
    wr.partner_id = p_partner_id
    AND wr.selected_session_type = p_session_type
    AND wr.status != 'cancelled'
    AND wr.payment_status = 'paid'
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts IS
  'Returns per-session registration counts for availability tracking. Counts PAID registrations only (pending Stripe checkouts no longer hold a slot — see 20260530 migration).';

-- ----- v2: + optional location ------------------------------------------

CREATE OR REPLACE FUNCTION get_workshop_registration_counts_v2(
  p_partner_id TEXT,
  p_session_type TEXT,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE(workshop_id TEXT, registration_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    unnest(wr.selected_workshop_ids) AS workshop_id,
    COUNT(*) AS registration_count
  FROM workshop_registrations wr
  WHERE
    wr.partner_id = p_partner_id
    AND wr.selected_session_type = p_session_type
    AND wr.status != 'cancelled'
    AND (p_location IS NULL OR wr.location = p_location)
    AND wr.payment_status = 'paid'
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts_v2 IS
  'Location-aware version. Counts PAID registrations only.';

-- ----- v3: + optional location + time_slot ------------------------------

CREATE OR REPLACE FUNCTION get_workshop_registration_counts_v3(
  p_partner_id TEXT,
  p_session_type TEXT,
  p_location TEXT DEFAULT NULL,
  p_time_slot TEXT DEFAULT NULL
)
RETURNS TABLE(workshop_id TEXT, registration_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT
    unnest(wr.selected_workshop_ids) AS workshop_id,
    COUNT(*) AS registration_count
  FROM workshop_registrations wr
  WHERE
    wr.partner_id = p_partner_id
    AND wr.selected_session_type = p_session_type
    AND wr.status != 'cancelled'
    AND (p_location IS NULL OR wr.location = p_location)
    AND (p_time_slot IS NULL OR wr.time_slot = p_time_slot)
    AND wr.payment_status = 'paid'
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts_v3 IS
  'Location + time-slot-aware version. Counts PAID registrations only.';
