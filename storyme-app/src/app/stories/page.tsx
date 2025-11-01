/**
 * Public Stories Gallery Page
 * Browse all public stories from the community
 * Features: Tag filtering, search, sorting, pagination
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LandingNav from '@/components/navigation/LandingNav';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';
import type { StoryTag } from '@/lib/types/story';

interface PublicStory extends StoryCardData {
  publishedAt: string;
  tags?: StoryTag[];
}

export default function PublicStoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [availableTags, setAvailableTags] = useState<StoryTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent'>('recent');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetchTags();
  }, []);

  useEffect(() => {
    fetchPublicStories();
  }, [sortBy, selectedTags, searchQuery, currentPage]);

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
      const tags = selectedTags.join(',');
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

  const toggleTag = (tagSlug: string) => {
    setSelectedTags(prev =>
      prev.includes(tagSlug) ? prev.filter(t => t !== tagSlug) : [...prev, tagSlug]
    );
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setSearchQuery('');
    setCurrentPage(1);
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

  // Separate featured and regular stories
  const featuredStories = stories.filter(s => s.featured);
  const regularStories = stories.filter(s => !s.featured);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Page Header with Search */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Community Stories
              </h1>
              <p className="text-gray-600 text-lg">
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
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Filter by:</span>
            <button
              onClick={() => {
                setSelectedTags([]);
                setCurrentPage(1);
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
              .sort((a, b) => a.displayOrder - b.displayOrder)
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

            {(selectedTags.length > 0 || searchQuery) && (
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

        {/* Featured Stories */}
        {!loading && !error && featuredStories.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>⭐</span>
              <span>Featured Stories</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {featuredStories.map((story) => (
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
        )}

        {/* Regular Stories */}
        {!loading && !error && regularStories.length > 0 && (
          <div>
            {featuredStories.length > 0 && (
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>📖</span>
                <span>All Stories</span>
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {regularStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onClick={() => handleStoryClick(story.id)}
                  variant="community"
                  showFeaturedBadge={false}
                  showViewCount={true}
                  showAuthor={true}
                />
              ))}
            </div>
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
    </div>
  );
}
