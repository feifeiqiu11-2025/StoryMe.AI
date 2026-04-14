/**
 * Community Stories Page (Dashboard Version)
 * Browse all public stories from the community
 * Features: Tag filtering, search, sorting, pagination
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';
import type { StoryTag } from '@/lib/types/story';

interface PublicStory extends StoryCardData {
  publishedAt: string;
  tags?: StoryTag[];
}

function CommunityStoriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [availableTags, setAvailableTags] = useState<StoryTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent'>('recent');
  const [selectedCustomTag, setSelectedCustomTag] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 24;

  // Read filters from URL on mount
  useEffect(() => {
    const filterParam = searchParams.get('filter');
    if (filterParam) {
      setSelectedTags([filterParam]);
    }
    const customTagParam = searchParams.get('customTag');
    if (customTagParam) {
      setSelectedCustomTag(customTagParam);
    }
    fetchTags();
  }, []);

  useEffect(() => {
    fetchPublicStories();
  }, [sortBy, selectedTags, searchQuery, currentPage, selectedCustomTag]);

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchPublicStories = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const allTagSlugs = [...selectedTags];
      if (selectedCustomTag) allTagSlugs.push(selectedCustomTag);
      const tags = allTagSlugs.join(',');
      const search = searchQuery.trim();

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
        sortBy,
      });

      if (tags) params.append('tags', tags);
      if (search) params.append('search', search);

      const response = await fetch(`/api/stories/public?${params.toString()}`);
      const data = await response.json();

      if (response.ok && data.stories) {
        setStories(data.stories);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        throw new Error(data.error || 'Failed to load stories');
      }
    } catch (err) {
      console.error('Error fetching public stories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  // Helper to sync filter state to URL
  const updateFilterUrl = (filter?: string, customTag?: string) => {
    const params = new URLSearchParams();
    if (filter) params.set('filter', filter);
    if (customTag) params.set('customTag', customTag);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  };

  const toggleTag = (tagSlug: string) => {
    // Single selection: clicking a tag replaces the current selection
    setSelectedTags([tagSlug]);
    setCurrentPage(1);
    updateFilterUrl(tagSlug, selectedCustomTag || undefined);
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSelectedCustomTag('');
    setSearchQuery('');
    setCurrentPage(1);
    router.replace(window.location.pathname, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | string)[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  };

  const handleStoryClick = (storyId: string) => {
    router.push(`/stories/${storyId}`);
  };

  // Group stories by subcategory when filtering by Collections or Learning
  const getGroupedStories = () => {
    // Only group if we're filtering by a single category tag
    if (selectedTags.length !== 1) return null;

    const selectedTag = availableTags.find(t => t.slug === selectedTags[0]);
    if (!selectedTag) return null;

    // Only group for Collections and Learning categories
    if (selectedTag.category !== 'collections' && selectedTag.category !== 'learning') {
      return null;
    }

    // Group stories by their subcategory tags
    const grouped = new Map<string, PublicStory[]>();

    stories.forEach(story => {
      if (!story.tags) return;

      story.tags.forEach(tag => {
        // Only include tags that belong to the selected category and have a parent (are subcategories)
        if (tag.category === selectedTag.category && tag.parentId) {
          if (!grouped.has(tag.name)) {
            grouped.set(tag.name, []);
          }
          // Add story if not already in this group
          const groupStories = grouped.get(tag.name)!;
          if (!groupStories.find(s => s.id === story.id)) {
            groupStories.push(story);
          }
        }
      });
    });

    // Convert to array and sort by subcategory name
    return Array.from(grouped.entries())
      .map(([subCategory, stories]) => ({ subCategory, stories }))
      .sort((a, b) => a.subCategory.localeCompare(b.subCategory));
  };

  const groupedStories = getGroupedStories();

  // Sort stories: featured first, then preserve API sort order
  const sortedStories = [...stories].sort((a, b) => {
    if (a.featured && !b.featured) return -1;
    if (!a.featured && b.featured) return 1;
    return 0;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header with Search */}
        <div className="mb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">
                Community Stories
              </h1>
              <p className="text-gray-600">
                Discover amazing stories created by kids and families around the world!
              </p>
            </div>

            {/* Search and Sort - Same row as title */}
            <div className="flex items-center gap-2 w-full sm:w-auto flex-shrink-0">
              <input
                type="text"
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="flex-1 sm:w-52 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'popular' | 'recent')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="recent">Most Recent</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tag Filters */}
        <div className="mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Filter by:</span>
            <button
              onClick={() => {
                setSelectedTags([]);
                setCurrentPage(1);
                updateFilterUrl(undefined, selectedCustomTag || undefined);
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                selectedTags.length === 0
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Stories
            </button>

            {availableTags
              .filter(tag =>
                // Only show top-level categories (Collections, Learning) and special categories (Avocado, Original)
                // Exclude 'custom' — it gets its own dropdown
                ((!tag.isLeaf && tag.parentId === null && tag.category !== 'custom') ||
                (tag.isLeaf && tag.parentId === null && (tag.category === 'avocado-ama' || tag.category === 'original-stories')))
              )
              .sort((a, b) => {
                const order = ['collections', 'learning', 'avocado-ama', 'original-stories'];
                return order.indexOf(a.category || '') - order.indexOf(b.category || '');
              })
              .map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.slug)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all inline-flex items-center gap-1.5 ${
                    selectedTags.includes(tag.slug)
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag.icon && <span>{tag.icon}</span>}
                  <span>{tag.name}</span>
                </button>
              ))}

            {/* Custom Tags Dropdown */}
            {availableTags.some(t => t.category === 'custom' && t.isLeaf) && (
              <>
                <span className="text-gray-300">|</span>
                <select
                  value={selectedCustomTag}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedCustomTag(val);
                    setCurrentPage(1);
                    updateFilterUrl(selectedTags[0] || undefined, val || undefined);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-md text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Custom Tags</option>
                  {availableTags
                    .filter(t => t.category === 'custom' && t.isLeaf)
                    .sort((a, b) => a.displayOrder - b.displayOrder)
                    .map(tag => (
                      <option key={tag.id} value={tag.slug}>
                        {tag.name}
                      </option>
                    ))}
                </select>
              </>
            )}

            {(selectedTags.length > 0 || searchQuery || selectedCustomTag) && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <p className="text-red-600 text-lg mb-4">❌ {error}</p>
            <button
              onClick={() => fetchPublicStories()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Stories - Grouped by subcategory or unified grid (featured first with badges) */}
        {!loading && !error && sortedStories.length > 0 && (
          <div>
            {groupedStories ? (
              // Show grouped by subcategory
              <div className="space-y-12">
                {groupedStories.map(group => (
                  <div key={group.subCategory}>
                    <h3 className="text-xl sm:text-2xl font-semibold text-gray-700 mb-4">
                      {group.subCategory}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {group.stories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          onClick={() => handleStoryClick(story.id)}
                          variant="community"
                          showFeaturedBadge={true}
                          showViewCount={true}
                          showAuthor={true}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Unified grid — featured stories appear first with badge
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onClick={() => handleStoryClick(story.id)}
                    variant="community"
                    showFeaturedBadge={true}
                    showViewCount={true}
                    showAuthor={true}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && stories.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No stories found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || selectedTags.length > 0
                ? 'Try adjusting your search or filters'
                : 'Be the first to share a story!'}
            </p>
            {(searchQuery || selectedTags.length > 0) && (
              <button
                onClick={clearFilters}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Story Count and Pagination */}
        {!loading && !error && stories.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            {/* Story Count */}
            <div className="mb-6">
              <p className="text-sm text-gray-600">
                Showing {stories.length} of {totalCount} stories
                {searchQuery && <span className="font-medium"> matching "{searchQuery}"</span>}
              </p>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>

                  {getPageNumbers().map((page, idx) =>
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium ${
                          page === currentPage
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

export default function CommunityStoriesPage() {
  return (
    <Suspense>
      <CommunityStoriesContent />
    </Suspense>
  );
}
