-- Add subject_type column to character_library table
-- This stores the AI-detected type of subject in the reference image
-- Values: 'human', 'animal', 'creature', 'object', 'scenery'
-- Default: 'human' for backwards compatibility with existing characters

ALTER TABLE character_library
ADD COLUMN IF NOT EXISTS subject_type TEXT DEFAULT 'human';

-- Add a comment to document the column
COMMENT ON COLUMN character_library.subject_type IS 'AI-detected subject type: human, animal, creature, object, or scenery. Default human for backwards compatibility.';
