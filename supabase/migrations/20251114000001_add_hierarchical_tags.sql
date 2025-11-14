-- Add Hierarchical Structure to Story Tags
-- Adds category, parent_id, and is_leaf fields for two-level hierarchy

-- ============================================
-- 1. ADD NEW COLUMNS TO story_tags
-- ============================================

-- Add category field (collections, learning, special)
ALTER TABLE story_tags
ADD COLUMN IF NOT EXISTS category VARCHAR(50);

-- Add parent_id for hierarchical structure (nullable for top-level categories)
ALTER TABLE story_tags
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES story_tags(id) ON DELETE CASCADE;

-- Add is_leaf flag (true = can be tagged directly, false = category only)
ALTER TABLE story_tags
ADD COLUMN IF NOT EXISTS is_leaf BOOLEAN DEFAULT true;

-- ============================================
-- 2. CREATE INDEX FOR parent_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_story_tags_parent_id ON story_tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_story_tags_category ON story_tags(category);

-- ============================================
-- 3. UPDATE EXISTING TAGS WITH CATEGORIES
-- ============================================

-- Update existing tags to have proper categories
-- Avocado (AMA) - both category and tag
UPDATE story_tags
SET category = 'avocado-ama', is_leaf = true, parent_id = NULL
WHERE slug = 'avocado-ama';

-- Original Stories - both category and tag
UPDATE story_tags
SET category = 'original-stories', is_leaf = true, parent_id = NULL
WHERE slug = 'original-stories';

-- Chinese Stories - will become a sub-category of Learning
UPDATE story_tags
SET category = 'learning', is_leaf = true
WHERE slug = 'chinese-stories';

-- Bedtime Stories - will become a sub-category of Collections
UPDATE story_tags
SET category = 'collections', is_leaf = true
WHERE slug = 'bedtime-stories';

-- Learning - becomes a top-level category (not directly taggable)
UPDATE story_tags
SET category = 'learning', is_leaf = false, parent_id = NULL
WHERE slug = 'learning';

-- ============================================
-- 4. INSERT NEW CATEGORY TAGS
-- ============================================

-- Insert Collections top-level category (not directly taggable)
INSERT INTO story_tags (name, slug, category, icon, description, is_leaf, parent_id, display_order)
VALUES ('Collections', 'collections', 'collections', '📚', 'Thematic story collections', false, NULL, 10)
ON CONFLICT (slug) DO UPDATE SET
  category = EXCLUDED.category,
  is_leaf = EXCLUDED.is_leaf,
  parent_id = EXCLUDED.parent_id;

-- ============================================
-- 5. INSERT COLLECTION SUB-CATEGORIES
-- ============================================

-- Get the Collections category ID for parent_id
DO $$
DECLARE
  collections_id UUID;
  learning_id UUID;
BEGIN
  -- Get Collections category ID
  SELECT id INTO collections_id FROM story_tags WHERE slug = 'collections';

  -- Get Learning category ID
  SELECT id INTO learning_id FROM story_tags WHERE slug = 'learning';

  -- Insert Collection sub-categories (all are taggable leaves)
  INSERT INTO story_tags (name, slug, category, icon, description, is_leaf, parent_id, display_order) VALUES
    ('Space & Science', 'space-science', 'collections', '🚀', 'Stories about space, planets, and science', true, collections_id, 11),
    ('Animal Adventures', 'animals', 'collections', '🦁', 'Stories featuring animals and nature', true, collections_id, 12),
    ('Cool Jobs', 'jobs-careers', 'collections', '👷', 'Stories about different careers and professions', true, collections_id, 13),
    ('Fantasy & Magic', 'fantasy-magic', 'collections', '🏰', 'Stories with dragons, princesses, and magic', true, collections_id, 14),
    ('Sports & Play', 'sports', 'collections', '⚽', 'Stories about sports and physical activities', true, collections_id, 15),
    ('Family & Friends', 'family-friends', 'collections', '🏠', 'Stories about relationships and kindness', true, collections_id, 16)
  ON CONFLICT (slug) DO UPDATE SET
    category = EXCLUDED.category,
    parent_id = EXCLUDED.parent_id,
    is_leaf = EXCLUDED.is_leaf;

  -- Update Bedtime Stories to have Collections as parent
  UPDATE story_tags
  SET parent_id = collections_id, display_order = 17
  WHERE slug = 'bedtime-stories';

  -- ============================================
  -- 6. INSERT LEARNING SUB-CATEGORIES
  -- ============================================

  INSERT INTO story_tags (name, slug, category, icon, description, is_leaf, parent_id, display_order) VALUES
    ('Early Math', 'math', 'learning', '🔢', 'Stories teaching counting, shapes, and math concepts', true, learning_id, 21),
    ('STEM', 'stem', 'learning', '🔬', 'Stories about science, technology, engineering', true, learning_id, 22),
    ('Life Skills', 'life-skills', 'learning', '💡', 'Stories teaching self-care, manners, responsibility', true, learning_id, 23)
  ON CONFLICT (slug) DO UPDATE SET
    category = EXCLUDED.category,
    parent_id = EXCLUDED.parent_id,
    is_leaf = EXCLUDED.is_leaf;

  -- Update Chinese Stories to have Learning as parent
  UPDATE story_tags
  SET parent_id = learning_id,
      name = 'Chinese Learning',
      display_order = 20
  WHERE slug = 'chinese-stories';

END $$;

-- ============================================
-- 7. ADD CONSTRAINT TO ENFORCE DATA INTEGRITY
-- ============================================

-- Ensure leaf nodes have parent_id (except for special categories like Avocado/Original)
-- Non-leaf nodes should not have parent_id (they are top-level categories)
-- This is a soft constraint via application logic, not database constraint

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
-- This migration adds:
-- 1. category, parent_id, is_leaf columns to story_tags
-- 2. Indexes for performance
-- 3. Collections and Learning as top-level categories
-- 4. Sub-categories under Collections (Space, Animals, Jobs, etc.)
-- 5. Sub-categories under Learning (Chinese, Math, STEM, etc.)
-- 6. Avocado (AMA) and Original Stories as standalone categories
-- 7. Maintains backwards compatibility with existing tags
