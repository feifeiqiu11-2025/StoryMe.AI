-- Migration: Add time_slot column for per-slot capacity tracking
-- Date: 2026-03-17
-- Description: Adds time_slot column for partners with multiple time slots
--              per location (e.g., Avocado Montessori: slot-1 / slot-2).
--              Creates v3 RPC that supports time_slot filtering.
--              v1 and v2 RPCs remain untouched (SteamOji uses v1).

-- ============================================================================
-- ADD TIME_SLOT COLUMN
-- ============================================================================

ALTER TABLE workshop_registrations
  ADD COLUMN IF NOT EXISTS time_slot TEXT;

-- Index for time-slot-filtered availability queries
CREATE INDEX IF NOT EXISTS idx_workshop_reg_time_slot
  ON workshop_registrations (partner_id, location, time_slot)
  WHERE time_slot IS NOT NULL;

-- ============================================================================
-- RPC FUNCTION v3: Location + Time Slot aware registration counts
-- Identical to v2 but adds optional p_time_slot parameter.
-- ============================================================================

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
    AND (
      wr.payment_status = 'paid'
      OR (
        wr.payment_status = 'pending'
        AND wr.created_at > NOW() - INTERVAL '30 minutes'
      )
    )
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts_v3 IS
  'Location + time-slot-aware version of registration counts. Pass p_time_slot to filter by slot, or NULL for all.';
