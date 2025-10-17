-- Fix CASCADE DELETE constraint on generated_images.project_id
-- This allows projects to be deleted even when they have generated images

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE generated_images
  DROP CONSTRAINT IF EXISTS generated_images_project_id_fkey;

-- Step 2: Add the constraint back with ON DELETE CASCADE
ALTER TABLE generated_images
  ADD CONSTRAINT generated_images_project_id_fkey
  FOREIGN KEY (project_id)
  REFERENCES projects(id)
  ON DELETE CASCADE;

-- Verify the constraint was added correctly
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name='generated_images'
  AND kcu.column_name='project_id';
