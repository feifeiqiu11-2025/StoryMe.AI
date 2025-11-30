-- Performance Indexes Migration
-- Run this in Supabase Dashboard → SQL Editor
-- These indexes will significantly speed up project queries

-- Index for fetching scenes by project
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);

-- Index for fetching generated images by scene
CREATE INDEX IF NOT EXISTS idx_generated_images_scene_id ON generated_images(scene_id);

-- Index for fetching generated images by project (for cleanup operations)
CREATE INDEX IF NOT EXISTS idx_generated_images_project_id ON generated_images(project_id);

-- Index for fetching project tags
CREATE INDEX IF NOT EXISTS idx_project_tags_project_id ON project_tags(project_id);

-- Index for fetching projects by user (most common query)
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- Composite index for fetching user projects sorted by date (optimal for pagination)
CREATE INDEX IF NOT EXISTS idx_projects_user_id_created_at ON projects(user_id, created_at DESC);

-- Index for public stories query
CREATE INDEX IF NOT EXISTS idx_projects_visibility_status ON projects(visibility, status);

-- Index for audio pages lookup
CREATE INDEX IF NOT EXISTS idx_story_audio_pages_project_id ON story_audio_pages(project_id);

-- Index for quiz questions lookup
CREATE INDEX IF NOT EXISTS idx_quiz_questions_project_id ON quiz_questions(project_id);

-- Analyze tables to update query planner statistics
ANALYZE projects;
ANALYZE scenes;
ANALYZE generated_images;
ANALYZE project_tags;
ANALYZE story_audio_pages;
ANALYZE quiz_questions;
