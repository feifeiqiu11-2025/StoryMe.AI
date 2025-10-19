/**
 * Featured Stories Carousel
 * Displays top 10 public stories on the landing page
 * Auto-rotates and allows clicking to view full stories
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface FeaturedStory {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  viewCount: number;
  authorName?: string;
  scenes?: Array<{
    imageUrl: string | null;
  }>;
}

interface FeaturedStoriesCarouselProps {
  onStoryClick?: (storyId: string) => void;
}

export default function FeaturedStoriesCarousel({ onStoryClick }: FeaturedStoriesCarouselProps) {
  const [stories, setStories] = useState<FeaturedStory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFeaturedStories();
  }, []);

  // Auto-rotate carousel every 5 seconds
  useEffect(() => {
    if (stories.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % stories.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [stories.length]);

  const fetchFeaturedStories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stories/public?limit=10&featured=true');
      const data = await response.json();

      if (response.ok && data.projects) {
        setStories(data.projects);
      } else {
        throw new Error(data.error || 'Failed to load stories');
      }
    } catch (err) {
      console.error('Error fetching featured stories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + stories.length) % stories.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % stories.length);
  };

  const handleStoryClick = (storyId: string) => {
    onStoryClick?.(storyId);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading amazing stories...</p>
      </div>
    );
  }

  if (error || stories.length === 0) {
    return (
      <div className="bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl shadow-xl p-12 text-center">
        <div className="text-6xl mb-4">📚</div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">
          No Stories Yet
        </h3>
        <p className="text-gray-600">
          Be the first to create and share a story with the community!
        </p>
      </div>
    );
  }

  const currentStory = stories[currentIndex];
  const coverImage = currentStory.coverImageUrl || currentStory.scenes?.[0]?.imageUrl;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
          <span>🌟</span>
          <span>Featured Stories from Our Community</span>
          <span>🌟</span>
        </h2>
        <p className="text-gray-600 text-lg">
          Amazing stories created by kids and families like you!
        </p>
      </div>

      {/* Carousel */}
      <div className="relative bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Story Display */}
        <div className="grid md:grid-cols-2 gap-0">
          {/* Left: Image */}
          <div className="relative aspect-square md:aspect-auto bg-gradient-to-br from-blue-100 to-purple-100">
            {coverImage ? (
              <img
                src={coverImage}
                alt={currentStory.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-8xl">📖</span>
              </div>
            )}
            {/* Navigation Arrows */}
            <button
              onClick={handlePrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
              aria-label="Previous story"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
              aria-label="Next story"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Right: Story Info */}
          <div className="p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                  🌍 Public Story
                </span>
                <span className="text-gray-500 text-sm flex items-center gap-1">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  {currentStory.viewCount || 0} views
                </span>
              </div>

              <h3 className="text-3xl font-bold text-gray-900 mb-3">
                {currentStory.title}
              </h3>

              {currentStory.description && (
                <p className="text-gray-600 text-lg mb-4 line-clamp-3">
                  {currentStory.description}
                </p>
              )}

              {currentStory.authorName && (
                <p className="text-sm text-gray-500 italic">
                  by {currentStory.authorName}
                </p>
              )}
            </div>

            <div className="space-y-4 mt-6">
              <button
                onClick={() => handleStoryClick(currentStory.id)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                📖 Read This Story
              </button>

              <Link
                href="/signup"
                className="block w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all text-center"
              >
                ✨ Create Your Own Story
              </Link>
            </div>
          </div>
        </div>

        {/* Pagination Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black bg-opacity-50 px-4 py-2 rounded-full">
          {stories.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white bg-opacity-50 hover:bg-opacity-75'
              }`}
              aria-label={`Go to story ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* View All Link */}
      {stories.length >= 10 && (
        <div className="text-center">
          <Link
            href="/stories"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-lg transition-colors"
          >
            <span>View All Public Stories</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
