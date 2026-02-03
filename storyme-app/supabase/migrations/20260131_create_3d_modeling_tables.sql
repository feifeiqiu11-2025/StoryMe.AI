-- Migration: Create 3D Modeling Tables
-- Date: 2026-01-31
-- Description: Tables for 3D printable character feature
-- Following KindleWood design principles (security, scalability, clear contracts)

-- ============================================================================
-- TEMPLATES
-- ============================================================================

-- Templates define different character types (creature, structure, vehicle)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('creature', 'structure', 'vehicle')),
  description TEXT,
  piece_count INTEGER NOT NULL CHECK (piece_count BETWEEN 3 AND 10),
  preview_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Template piece configurations
CREATE TABLE IF NOT EXISTS template_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL, -- 'body', 'head', 'leg', etc.
  display_name TEXT NOT NULL,
  drawing_prompt TEXT NOT NULL,
  reference_image_url TEXT,
  suggested_colors JSONB DEFAULT '[]'::jsonb,
  connection_points JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, piece_number),
  CHECK (jsonb_typeof(suggested_colors) = 'array'),
  CHECK (jsonb_typeof(connection_points) = 'array')
);

-- ============================================================================
-- USER PROJECTS
-- ============================================================================

-- 3D Projects created by users
CREATE TABLE IF NOT EXISTS projects_3d (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  character_id UUID NOT NULL,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Metadata
  character_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'drawing'
    CHECK (status IN ('drawing', 'generating', 'review', 'completed', 'failed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ -- Soft delete
);

-- Add foreign key to character_library table (if it exists and constraint doesn't exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_library')
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.table_constraints
       WHERE constraint_name = 'projects_3d_character_id_fkey'
       AND table_name = 'projects_3d'
     ) THEN
    ALTER TABLE projects_3d
      ADD CONSTRAINT projects_3d_character_id_fkey
      FOREIGN KEY (character_id) REFERENCES character_library(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Individual pieces (drawings + 3D models)
CREATE TABLE IF NOT EXISTS project_pieces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  project_id UUID NOT NULL REFERENCES projects_3d(id) ON DELETE CASCADE,
  template_piece_id UUID REFERENCES template_pieces(id) ON DELETE RESTRICT,

  -- Piece info
  piece_number INTEGER NOT NULL CHECK (piece_number > 0),
  piece_type TEXT NOT NULL,

  -- Child's drawing
  drawing_image_url TEXT,
  drawing_data JSONB, -- Excalidraw scene data for editing
  drawing_uploaded_at TIMESTAMPTZ,

  -- Generated 3D model
  model_3d_url TEXT, -- STL file
  model_preview_url TEXT, -- PNG thumbnail
  model_generated_at TIMESTAMPTZ,
  generation_status TEXT DEFAULT 'pending'
    CHECK (generation_status IN ('pending', 'processing', 'completed', 'failed')),
  generation_error TEXT,

  -- Print metadata
  estimated_print_time_minutes INTEGER,
  estimated_filament_grams DECIMAL(6,2),

  -- Versioning (for when kids redraw)
  version INTEGER DEFAULT 1,
  is_current_version BOOLEAN DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CHECK (
    (model_3d_url IS NOT NULL AND model_generated_at IS NOT NULL)
    OR model_3d_url IS NULL
  )
);

-- AI enhancements applied (audit trail)
CREATE TABLE IF NOT EXISTS piece_enhancements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  piece_id UUID NOT NULL REFERENCES project_pieces(id) ON DELETE CASCADE,

  enhancement_type TEXT NOT NULL
    CHECK (enhancement_type IN ('thickening', 'support_added', 'connection_point', 'smoothing', 'gemini_enhancement')),
  location TEXT NOT NULL,
  reason TEXT NOT NULL, -- Kid-friendly explanation
  parameters JSONB, -- Technical details

  applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_template_pieces_template ON template_pieces(template_id);

CREATE INDEX IF NOT EXISTS idx_projects_3d_creator ON projects_3d(creator_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_3d_character ON projects_3d(character_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_3d_status ON projects_3d(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_3d_created ON projects_3d(created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_project_pieces_project ON project_pieces(project_id);
CREATE INDEX IF NOT EXISTS idx_project_pieces_current ON project_pieces(project_id, is_current_version)
  WHERE is_current_version = true;
CREATE INDEX IF NOT EXISTS idx_project_pieces_generation ON project_pieces(generation_status)
  WHERE generation_status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_piece_enhancements_piece ON piece_enhancements(piece_id);

-- Partial unique index: Only one current version per project/piece_number
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_pieces_unique_current
  ON project_pieces(project_id, piece_number)
  WHERE is_current_version = true;

-- ============================================================================
-- ROW-LEVEL SECURITY (Principle 1: Security by Default)
-- ============================================================================

-- Enable RLS on all tables (idempotent)
DO $$
BEGIN
  ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
  ALTER TABLE template_pieces ENABLE ROW LEVEL SECURITY;
  ALTER TABLE projects_3d ENABLE ROW LEVEL SECURITY;
  ALTER TABLE project_pieces ENABLE ROW LEVEL SECURITY;
  ALTER TABLE piece_enhancements ENABLE ROW LEVEL SECURITY;
EXCEPTION
  WHEN OTHERS THEN NULL; -- Ignore if already enabled
END $$;

-- Create policies (drop if exists, then create)
DROP POLICY IF EXISTS "templates_public_read" ON templates;
CREATE POLICY "templates_public_read" ON templates
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "template_pieces_public_read" ON template_pieces;
CREATE POLICY "template_pieces_public_read" ON template_pieces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM templates
      WHERE templates.id = template_pieces.template_id
        AND templates.is_active = true
    )
  );

DROP POLICY IF EXISTS "users_own_projects_select" ON projects_3d;
CREATE POLICY "users_own_projects_select" ON projects_3d
  FOR SELECT
  USING (auth.uid() = creator_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "users_create_projects" ON projects_3d;
CREATE POLICY "users_create_projects" ON projects_3d
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "users_update_own_projects" ON projects_3d;
CREATE POLICY "users_update_own_projects" ON projects_3d
  FOR UPDATE
  USING (auth.uid() = creator_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "users_delete_own_projects" ON projects_3d;
CREATE POLICY "users_delete_own_projects" ON projects_3d
  FOR DELETE
  USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "users_own_pieces_select" ON project_pieces;
CREATE POLICY "users_own_pieces_select" ON project_pieces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects_3d
      WHERE projects_3d.id = project_pieces.project_id
        AND projects_3d.creator_id = auth.uid()
        AND projects_3d.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "users_create_pieces" ON project_pieces;
CREATE POLICY "users_create_pieces" ON project_pieces
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects_3d
      WHERE projects_3d.id = project_pieces.project_id
        AND projects_3d.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_update_own_pieces" ON project_pieces;
CREATE POLICY "users_update_own_pieces" ON project_pieces
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects_3d
      WHERE projects_3d.id = project_pieces.project_id
        AND projects_3d.creator_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "users_read_enhancements" ON piece_enhancements;
CREATE POLICY "users_read_enhancements" ON piece_enhancements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_pieces
      JOIN projects_3d ON projects_3d.id = project_pieces.project_id
      WHERE project_pieces.id = piece_enhancements.piece_id
        AND projects_3d.creator_id = auth.uid()
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_3d_updated_at ON projects_3d;
CREATE TRIGGER update_projects_3d_updated_at BEFORE UPDATE ON projects_3d
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_pieces_updated_at ON project_pieces;
CREATE TRIGGER update_project_pieces_updated_at BEFORE UPDATE ON project_pieces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Auto-update project status when all pieces have drawings
CREATE OR REPLACE FUNCTION check_project_ready_for_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- If all pieces have drawings, mark project as ready
  IF (
    SELECT COUNT(*)
    FROM project_pieces
    WHERE project_id = NEW.project_id
      AND is_current_version = true
      AND drawing_image_url IS NULL
  ) = 0 THEN
    UPDATE projects_3d
    SET status = 'review'
    WHERE id = NEW.project_id AND status = 'drawing';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS piece_drawing_uploaded ON project_pieces;
CREATE TRIGGER piece_drawing_uploaded AFTER UPDATE ON project_pieces
  FOR EACH ROW
  WHEN (OLD.drawing_image_url IS NULL AND NEW.drawing_image_url IS NOT NULL)
  EXECUTE FUNCTION check_project_ready_for_generation();

-- Trigger: Mark project as completed when all models generated
CREATE OR REPLACE FUNCTION check_project_generation_complete()
RETURNS TRIGGER AS $$
BEGIN
  -- If all pieces have 3D models, mark project as completed
  IF (
    SELECT COUNT(*)
    FROM project_pieces
    WHERE project_id = NEW.project_id
      AND is_current_version = true
      AND model_3d_url IS NULL
  ) = 0 THEN
    UPDATE projects_3d
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE id = NEW.project_id AND status IN ('generating', 'review');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS piece_model_generated ON project_pieces;
CREATE TRIGGER piece_model_generated AFTER UPDATE ON project_pieces
  FOR EACH ROW
  WHEN (OLD.model_3d_url IS NULL AND NEW.model_3d_url IS NOT NULL)
  EXECUTE FUNCTION check_project_generation_complete();

-- ============================================================================
-- SEED DATA: Default Templates
-- ============================================================================

-- Insert default templates
INSERT INTO templates (name, category, description, piece_count, preview_image_url, is_active)
VALUES
  (
    'Simple Dinosaur',
    'creature',
    'A friendly 4-legged dinosaur with body, head, 4 legs, and tail',
    6,
    NULL, -- TODO: Add preview image
    true
  ),
  (
    'Simple House',
    'structure',
    'A basic house with foundation, walls, roof, and door',
    4,
    NULL,
    true
  ),
  (
    'Simple Car',
    'vehicle',
    'A basic car with body, cabin, and 4 wheels',
    6,
    NULL,
    true
  )
ON CONFLICT DO NOTHING;

-- Insert dinosaur template pieces
DO $$
DECLARE
  dino_template_id UUID;
BEGIN
  SELECT id INTO dino_template_id FROM templates WHERE name = 'Simple Dinosaur' LIMIT 1;

  IF dino_template_id IS NOT NULL THEN
    INSERT INTO template_pieces (
      template_id, piece_number, piece_type, display_name, drawing_prompt,
      suggested_colors, connection_points
    )
    VALUES
      (
        dino_template_id, 1, 'body', 'Body',
        'Draw the dino''s big round body',
        '["#90EE90", "#98D8C8", "#87CEEB"]'::jsonb,
        '[{"type": "slot", "connects_to_piece": 2, "position": "top", "size": "medium"}]'::jsonb
      ),
      (
        dino_template_id, 2, 'head', 'Head',
        'Draw the dino''s head with a big smile and eyes',
        '["#90EE90", "#FFD700", "#FF69B4"]'::jsonb,
        '[{"type": "tab", "connects_to_piece": 1, "position": "bottom", "size": "medium"}]'::jsonb
      ),
      (
        dino_template_id, 3, 'leg', 'Front Left Leg',
        'Draw a sturdy front leg',
        '["#90EE90", "#8B4513"]'::jsonb,
        '[{"type": "tab", "connects_to_piece": 1, "position": "top", "size": "small"}]'::jsonb
      ),
      (
        dino_template_id, 4, 'leg', 'Front Right Leg',
        'Draw a sturdy front leg',
        '["#90EE90", "#8B4513"]'::jsonb,
        '[{"type": "tab", "connects_to_piece": 1, "position": "top", "size": "small"}]'::jsonb
      ),
      (
        dino_template_id, 5, 'leg', 'Back Left Leg',
        'Draw a sturdy back leg',
        '["#90EE90", "#8B4513"]'::jsonb,
        '[{"type": "tab", "connects_to_piece": 1, "position": "top", "size": "small"}]'::jsonb
      ),
      (
        dino_template_id, 6, 'leg', 'Back Right Leg',
        'Draw a sturdy back leg',
        '["#90EE90", "#8B4513"]'::jsonb,
        '[{"type": "tab", "connects_to_piece": 1, "position": "top", "size": "small"}]'::jsonb
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Create storage bucket for drawings (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('3d-drawings', '3d-drawings', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for 3D models (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('3d-models', '3d-models', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: Users can upload their own drawings
DROP POLICY IF EXISTS "users_upload_drawings" ON storage.objects;
CREATE POLICY "users_upload_drawings" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = '3d-drawings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "users_read_own_drawings" ON storage.objects;
CREATE POLICY "users_read_own_drawings" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = '3d-drawings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies: Users can read their own 3D models
DROP POLICY IF EXISTS "users_read_own_models" ON storage.objects;
CREATE POLICY "users_read_own_models" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = '3d-models'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE templates IS 'Predefined templates for different character types (creature, structure, vehicle)';
COMMENT ON TABLE template_pieces IS 'Piece configurations for each template (what to draw, connection points)';
COMMENT ON TABLE projects_3d IS 'User-created 3D printable projects';
COMMENT ON TABLE project_pieces IS 'Individual pieces (drawings + generated 3D models)';
COMMENT ON TABLE piece_enhancements IS 'Audit trail of AI enhancements applied to pieces';

COMMENT ON COLUMN projects_3d.status IS 'Workflow status: drawing → generating → review → completed';
COMMENT ON COLUMN project_pieces.drawing_data IS 'Excalidraw scene JSON for editing';
COMMENT ON COLUMN project_pieces.template_piece_id IS 'Reference to template piece (NULL for dynamic Gemini-generated pieces)';
COMMENT ON COLUMN project_pieces.is_current_version IS 'Allows kids to redraw pieces (version history)';
COMMENT ON COLUMN piece_enhancements.reason IS 'Kid-friendly explanation (e.g., "Made thicker so it won''t break!")';

-- Migration complete
