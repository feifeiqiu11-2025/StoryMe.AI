-- Migration: Support single-session mode + photo/video consent tracking
-- Date: 2026-03-13
-- Description:
--   1. Expands selected_session_type CHECK to include 'single' (for Avocado Montessori)
--   2. Adds photo_video_consent_accepted column for audit trail

-- ============================================================================
-- 1. EXPAND SESSION TYPE CHECK CONSTRAINT
-- ============================================================================
-- The original constraint only allows ('morning', 'afternoon').
-- Single-mode partners (Avocado) use 'single' as the session type.

ALTER TABLE workshop_registrations
  DROP CONSTRAINT IF EXISTS workshop_registrations_selected_session_type_check;

ALTER TABLE workshop_registrations
  ADD CONSTRAINT workshop_registrations_selected_session_type_check
  CHECK (selected_session_type IN ('morning', 'afternoon', 'single'));

-- ============================================================================
-- 2. ADD PHOTO/VIDEO CONSENT COLUMN
-- ============================================================================
-- Tracks whether the parent granted photo/video consent for their child's
-- artwork during workshop activities. Required for audit compliance.

ALTER TABLE workshop_registrations
  ADD COLUMN IF NOT EXISTS photo_video_consent_accepted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workshop_registrations
  ADD COLUMN IF NOT EXISTS photo_video_consent_accepted_at TIMESTAMPTZ;
