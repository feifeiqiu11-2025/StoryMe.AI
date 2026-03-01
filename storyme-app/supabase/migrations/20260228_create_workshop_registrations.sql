-- Migration: Create Workshop Registrations Table
-- Date: 2026-02-28
-- Description: Registration records for in-person workshop events

-- ============================================================================
-- WORKSHOP REGISTRATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workshop_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent / Guardian Info
  parent_first_name TEXT NOT NULL,
  parent_last_name TEXT NOT NULL,
  parent_email TEXT NOT NULL,
  parent_phone TEXT NOT NULL,

  -- Child Info
  child_first_name TEXT NOT NULL,
  child_last_name TEXT,
  child_age INTEGER NOT NULL CHECK (child_age >= 3 AND child_age <= 14),

  -- Emergency Contact
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  emergency_contact_relation TEXT NOT NULL,

  -- Workshop Selection
  partner_id TEXT NOT NULL,
  selected_workshop_ids TEXT[] NOT NULL,
  selected_session_type TEXT NOT NULL CHECK (selected_session_type IN ('morning', 'afternoon')),
  is_bundle BOOLEAN DEFAULT FALSE,

  -- Payment
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  payment_status TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  amount_paid INTEGER, -- in cents
  promo_code TEXT,

  -- Waiver
  waiver_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  waiver_accepted_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),

  -- Optional user link (if registered while logged in)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_workshop_reg_email ON workshop_registrations(parent_email);
CREATE INDEX IF NOT EXISTS idx_workshop_reg_partner ON workshop_registrations(partner_id);
CREATE INDEX IF NOT EXISTS idx_workshop_reg_status ON workshop_registrations(status);
CREATE INDEX IF NOT EXISTS idx_workshop_reg_payment ON workshop_registrations(payment_status);
CREATE INDEX IF NOT EXISTS idx_workshop_reg_created ON workshop_registrations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workshop_reg_stripe ON workshop_registrations(stripe_checkout_session_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION update_workshop_registration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workshop_reg_updated_at ON workshop_registrations;
CREATE TRIGGER trigger_workshop_reg_updated_at
BEFORE UPDATE ON workshop_registrations
FOR EACH ROW EXECUTE FUNCTION update_workshop_registration_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE workshop_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (public registration form, no auth required)
CREATE POLICY workshop_reg_insert_public ON workshop_registrations
  FOR INSERT WITH CHECK (true);

-- Users can view their own registrations (if they were logged in)
CREATE POLICY workshop_reg_own_select ON workshop_registrations
  FOR SELECT USING (user_id = auth.uid());

-- Service role has full access (for webhook updates, admin)
-- Note: service role bypasses RLS by default

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE workshop_registrations IS 'Registration records for in-person workshop events with payment tracking';
COMMENT ON COLUMN workshop_registrations.selected_workshop_ids IS 'Array of workshop session IDs from constants (e.g. steamoji-wk1)';
COMMENT ON COLUMN workshop_registrations.amount_paid IS 'Payment amount in cents';
COMMENT ON COLUMN workshop_registrations.is_bundle IS 'Whether the 5-workshop bundle discount was applied';
