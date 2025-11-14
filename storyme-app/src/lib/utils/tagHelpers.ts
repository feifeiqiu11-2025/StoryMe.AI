/**
 * Tag Helper Utilities
 * Functions to organize and filter hierarchical story tags
 */

import type { StoryTag, TagCategory } from '@/lib/types/story';

export interface GroupedTags {
  category: TagCategory;
  name: string;
  icon: string;
  tags: StoryTag[];
}

/**
 * Groups tags by their category for hierarchical display
 * Returns only leaf nodes (taggable items) grouped by their parent category
 */
export function groupTagsByCategory(tags: StoryTag[]): GroupedTags[] {
  // Find all top-level categories
  const categories = tags.filter(tag => !tag.isLeaf && tag.parentId === null);

  // Also include special categories that are both category and tag
  const specialCategories = tags.filter(
    tag => tag.isLeaf && tag.parentId === null && (tag.category === 'avocado-ama' || tag.category === 'original-stories')
  );

  const grouped: GroupedTags[] = [];

  // Group regular categories (Collections, Learning)
  for (const category of categories) {
    const childTags = tags.filter(
      tag => tag.parentId === category.id && tag.isLeaf
    );

    if (childTags.length > 0) {
      grouped.push({
        category: category.category as TagCategory,
        name: category.name,
        icon: category.icon || '',
        tags: childTags.sort((a, b) => a.displayOrder - b.displayOrder),
      });
    }
  }

  // Add special categories as standalone groups
  for (const specialTag of specialCategories) {
    grouped.push({
      category: specialTag.category as TagCategory,
      name: specialTag.name,
      icon: specialTag.icon || '',
      tags: [specialTag], // The category itself is the only tag
    });
  }

  return grouped.sort((a, b) => {
    // Order: Collections, Learning, Avocado (AMA), Original Stories
    const order = ['collections', 'learning', 'avocado-ama', 'original-stories'];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });
}

/**
 * Gets all taggable (leaf) tags, excluding category-only tags
 */
export function getLeafTags(tags: StoryTag[]): StoryTag[] {
  return tags
    .filter(tag => tag.isLeaf)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Gets tags for a specific category
 */
export function getTagsByCategory(tags: StoryTag[], category: TagCategory): StoryTag[] {
  return tags
    .filter(tag => tag.category === category && tag.isLeaf)
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/**
 * Checks if a tag is a top-level category (used for filtering)
 */
export function isTopLevelCategory(tag: StoryTag): boolean {
  return !tag.isLeaf && tag.parentId === null;
}

/**
 * Checks if a tag is a special category (both category and tag)
 */
export function isSpecialCategory(tag: StoryTag): boolean {
  return tag.isLeaf && tag.parentId === null &&
    (tag.category === 'avocado-ama' || tag.category === 'original-stories');
}

/**
 * Gets the display name for a category filter button
 */
export function getCategoryDisplayName(category: TagCategory | 'all'): string {
  const names: Record<TagCategory | 'all', string> = {
    all: 'All Stories',
    collections: 'Collections',
    learning: 'Learning',
    'avocado-ama': 'Avocado (AMA)',
    'original-stories': 'Original Stories',
  };
  return names[category];
}

/**
 * Gets the icon for a category filter button
 */
export function getCategoryIcon(category: TagCategory | 'all'): string {
  const icons: Record<TagCategory | 'all', string> = {
    all: '🌟',
    collections: '📚',
    learning: '🎓',
    'avocado-ama': '🥑',
    'original-stories': '✨',
  };
  return icons[category];
}
