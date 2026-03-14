-- Migration: Add location column for multi-location workshop partners
-- Date: 2026-03-13
-- Description: Adds location tracking for partners with multiple campuses
--              (e.g., Avocado Montessori: Bellevue & Kirkland).
--              Also adds a v2 RPC that supports optional location filtering.

-- ============================================================================
-- ADD LOCATION COLUMN
-- ============================================================================

ALTER TABLE workshop_registrations
  ADD COLUMN IF NOT EXISTS location TEXT;

-- Index for location-filtered availability queries
CREATE INDEX IF NOT EXISTS idx_workshop_reg_location
  ON workshop_registrations (partner_id, location)
  WHERE location IS NOT NULL;

-- ============================================================================
-- RPC FUNCTION v2: Location-aware registration counts
-- ============================================================================
-- Extends the original function with an optional p_location filter.
-- When p_location is NULL, behaves identically to v1 (all locations).

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
    AND (
      wr.payment_status = 'paid'
      OR (
        wr.payment_status = 'pending'
        AND wr.created_at > NOW() - INTERVAL '30 minutes'
      )
    )
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts_v2 IS
  'Location-aware version of registration counts. Pass p_location to filter by campus, or NULL for all.';
