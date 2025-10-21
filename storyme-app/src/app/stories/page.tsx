/**
 * Public Stories Gallery Page
 * Browse all public stories from the community
 * Includes filters, search, and grid layout
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PublicStory {
  id: string;
  title: string;
  description?: string;
  authorName?: string;
  authorAge?: number;
  viewCount: number;
  featured: boolean;
  publishedAt: string;
  scenes?: Array<{
    imageUrl: string | null;
  }>;
}

export default function PublicStoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<PublicStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'recent'>('popular');

  useEffect(() => {
    fetchPublicStories();
  }, [sortBy]);

  const fetchPublicStories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stories/public?limit=100`);
      const data = await response.json();

      if (response.ok && data.projects) {
        setStories(data.projects);
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

  // Filter and sort stories
  const filteredStories = stories
    .filter(story => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        story.title.toLowerCase().includes(query) ||
        story.description?.toLowerCase().includes(query) ||
        story.authorName?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (sortBy === 'popular') {
        return (b.viewCount || 0) - (a.viewCount || 0);
      } else {
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
    });

  // Separate featured stories
  const featuredStories = filteredStories.filter(s => s.featured);
  const regularStories = filteredStories.filter(s => !s.featured);

  const handleStoryClick = (storyId: string) => {
    router.push(`/stories/${storyId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link href="/" className="text-2xl font-bold">
                Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span>
              </Link>
              <nav className="flex gap-4">
                <Link href="/" className="text-gray-600 hover:text-gray-900 font-medium">
                  Home
                </Link>
                <Link href="/stories" className="text-blue-600 font-semibold">
                  Public Stories
                </Link>
              </nav>
            </div>
            <Link
              href="/login"
              className="text-gray-700 hover:text-gray-900 font-medium px-6 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              Sign In
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Community Stories
            </h1>
            <p className="text-gray-600 text-lg">
              Discover amazing stories created by kids and families around the world!
            </p>
          </div>

          {/* Filters & Search */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* Search */}
              <div className="flex-1 w-full">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stories by title, description, or author..."
                    className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <svg
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Sort */}
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('popular')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    sortBy === 'popular'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🔥 Popular
                </button>
                <button
                  onClick={() => setSortBy('recent')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    sortBy === 'recent'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  🕒 Recent
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-600">
              <span>📚 {filteredStories.length} stories</span>
              {featuredStories.length > 0 && (
                <span>⭐ {featuredStories.length} featured</span>
              )}
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading stories...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
              <div className="text-6xl mb-4">❌</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Failed to Load Stories
              </h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <button
                onClick={fetchPublicStories}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredStories.length === 0 && (
            <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {searchQuery ? 'No Stories Found' : 'No Public Stories Yet'}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery
                  ? 'Try adjusting your search query.'
                  : 'Be the first to create and share a story with the community!'}
              </p>
              <Link
                href="/signup"
                className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg transition-all"
              >
                Create Your First Story
              </Link>
            </div>
          )}

          {/* Featured Stories Section */}
          {!loading && !error && featuredStories.length > 0 && (
            <div className="mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span>⭐</span>
                <span>Featured Stories</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {featuredStories.map((story) => (
                  <StoryCard
                    key={story.id}
                    story={story}
                    onClick={() => handleStoryClick(story.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Regular Stories Grid */}
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
                  />
                ))}
              </div>
            </div>
          )}

          {/* CTA Section */}
          {!loading && !error && filteredStories.length > 0 && (
            <div className="mt-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl shadow-2xl p-8 sm:p-12 text-white text-center">
              <div className="text-5xl mb-4">✨📖✨</div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Create Your Own Story
              </h2>
              <p className="text-lg sm:text-xl mb-8 max-w-2xl mx-auto opacity-90">
                Turn your child's imagination into a beautiful storybook and share it with the world!
              </p>
              <Link
                href="/signup"
                className="inline-block bg-white text-purple-600 px-8 py-4 rounded-xl hover:bg-gray-50 font-bold text-lg shadow-xl transition-all"
              >
                Get Started - It's Free
              </Link>
            </div>
          )}
        </div>
      </div>
  );
}

// Story Card Component
function StoryCard({ story, onClick }: { story: PublicStory; onClick: () => void }) {
  const coverImage = story.scenes?.[0]?.imageUrl;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer"
    >
      {/* Cover Image */}
      <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-purple-100">
        {coverImage ? (
          <img
            src={coverImage}
            alt={story.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">📖</span>
          </div>
        )}

        {/* Featured Badge */}
        {story.featured && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            ⭐ Featured
          </div>
        )}

        {/* View Count */}
        <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-xs font-medium">
          👁️ {story.viewCount || 0}
        </div>
      </div>

      {/* Story Info */}
      <div className="p-4">
        <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-2">
          {story.title}
        </h3>
        {story.description && (
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
            {story.description}
          </p>
        )}
        {story.authorName && (
          <p className="text-xs text-gray-500 italic">
            by {story.authorName}
            {story.authorAge && `, age ${story.authorAge}`}
          </p>
        )}
      </div>
    </div>
  );
}
