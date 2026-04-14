-- Add "Custom" parent tag category for admin-created free-text story tags
-- Custom tags appear as a new group in community story filters alongside
-- Collections, Learning, Avocado (AMA), and Original Stories.

INSERT INTO story_tags (name, slug, category, icon, description, is_leaf, parent_id, display_order)
VALUES ('Custom', 'custom', 'custom', '🏷️', 'Admin-created custom tags for story categorization', false, NULL, 30)
ON CONFLICT (slug) DO UPDATE SET
  category = EXCLUDED.category,
  is_leaf = EXCLUDED.is_leaf,
  parent_id = EXCLUDED.parent_id,
  icon = EXCLUDED.icon,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;
