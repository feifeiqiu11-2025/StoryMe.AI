-- Fix RLS policies for support_submissions to allow anonymous submissions
-- This allows anyone (including non-authenticated users) to submit support tickets

-- Drop existing policies
DROP POLICY IF EXISTS support_submissions_insert_public ON support_submissions;
DROP POLICY IF EXISTS support_submissions_own_access ON support_submissions;
DROP POLICY IF EXISTS support_submissions_admin_access ON support_submissions;

-- Policy: Anyone (including anonymous) can insert support submissions
CREATE POLICY support_submissions_insert_anon ON support_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Authenticated users can view their own submissions
CREATE POLICY support_submissions_own_select ON support_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Admin can do everything
CREATE POLICY support_submissions_admin_all ON support_submissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email = 'feifei_qiu@hotmail.com'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.email = 'feifei_qiu@hotmail.com'
    )
  );
