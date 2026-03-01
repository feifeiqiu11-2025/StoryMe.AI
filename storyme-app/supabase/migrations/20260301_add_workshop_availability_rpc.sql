-- Migration: Add RPC function for workshop availability counting
-- Date: 2026-03-01
-- Description: Postgres function to count registrations per workshop session,
--              used by the availability API to track spot capacity.

-- ============================================================================
-- GIN INDEX for array lookups
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workshop_reg_selected_ids_gin
  ON workshop_registrations USING GIN (selected_workshop_ids);

-- ============================================================================
-- RPC FUNCTION: get_workshop_registration_counts
-- ============================================================================
-- Unnests selected_workshop_ids and counts registrations per session.
-- Counts paid registrations + recent pending (within 30 min).
-- Called via supabase.rpc('get_workshop_registration_counts', { ... })

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
    AND (
      wr.payment_status = 'paid'
      OR (
        wr.payment_status = 'pending'
        AND wr.created_at > NOW() - INTERVAL '30 minutes'
      )
    )
  GROUP BY unnest(wr.selected_workshop_ids);
$$;

COMMENT ON FUNCTION get_workshop_registration_counts IS
  'Returns per-session registration counts for availability tracking. Counts paid + recent pending (within 30 min).';
