-- Add animated_preview_url column to character_library table
-- This stores the URL of the Gemini-generated 3D Pixar-style character preview

ALTER TABLE character_library
ADD COLUMN IF NOT EXISTS animated_preview_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN character_library.animated_preview_url IS 'URL of the AI-generated 3D Pixar-style character preview image';
