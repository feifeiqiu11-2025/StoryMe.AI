-- ============================================
-- Public Characters Feature
-- Allow any is_public=TRUE character to be visible to all authenticated users
-- Previously restricted to source_type='artist_community' only
-- ============================================

-- Broaden existing policy: any public character is visible to all authenticated users
DROP POLICY IF EXISTS character_library_public_community ON character_library;
CREATE POLICY character_library_public_community ON character_library
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_public = TRUE);

-- Safety net: if a kid used a public character in their story and the teacher
-- later makes it private, the kid can still read the character data for their project
DROP POLICY IF EXISTS character_library_project_access ON character_library;
CREATE POLICY character_library_project_access ON character_library
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM project_characters pc
      JOIN projects p ON pc.project_id = p.id
      WHERE pc.character_library_id = character_library.id
      AND p.user_id = auth.uid()
    )
  );
