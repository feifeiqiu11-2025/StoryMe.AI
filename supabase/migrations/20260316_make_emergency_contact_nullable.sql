-- Migration: Make emergency contact fields nullable
-- Date: 2026-03-16
-- Description:
--   School-based partners (e.g., Avocado Montessori) don't collect emergency
--   contact info because the school already has it on file. Allow NULL values
--   for these columns so registrations can be created without them.

ALTER TABLE workshop_registrations
  ALTER COLUMN emergency_contact_name DROP NOT NULL;

ALTER TABLE workshop_registrations
  ALTER COLUMN emergency_contact_phone DROP NOT NULL;

ALTER TABLE workshop_registrations
  ALTER COLUMN emergency_contact_relation DROP NOT NULL;
