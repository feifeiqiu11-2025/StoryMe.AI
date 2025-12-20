-- Migration: Add PDF Import Support
-- Date: 2024-12-18
-- Description: Adds source_type and import_metadata columns to projects table
--              to track imported PDF storybooks

-- Add source_type column to distinguish created vs imported projects
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'created' CHECK (source_type IN ('created', 'imported_pdf'));

-- Add import_metadata for PDF-specific data (original filename, extraction time, etc.)
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS import_metadata JSONB;

-- Add index for filtering by source_type
CREATE INDEX IF NOT EXISTS idx_projects_source_type ON projects(source_type);

-- Comment for documentation
COMMENT ON COLUMN projects.source_type IS 'Source of the project: created (via story wizard) or imported_pdf (via PDF import)';
COMMENT ON COLUMN projects.import_metadata IS 'Metadata for imported projects: { original_filename, extraction_time, total_pages, gemini_model_used }';
