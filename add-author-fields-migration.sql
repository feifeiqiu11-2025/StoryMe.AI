-- Migration: Add author_name and author_age to projects table
-- This allows storing the child's name and age for personalized PDFs

ALTER TABLE projects
ADD COLUMN IF NOT EXISTS author_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS author_age INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN projects.author_name IS 'Name of the story author (typically the child)';
COMMENT ON COLUMN projects.author_age IS 'Age of the story author (1-12)';
