/**
 * Community Stories Carousel Component
 * Netflix-style horizontal scrolling carousel of featured stories
 * Auto-scrolls and supports manual navigation
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import StoryCarouselCard, { type MockStory } from './StoryCarouselCard';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

// Mock stories for when no real stories exist
const MOCK_STORIES: MockStory[] = [
  { title: 'Dragon Adventure', emoji: '🐉', author: 'Connor, 4', gradient: 'from-orange-400 to-red-500' },
  { title: 'Fun Soccer Time', emoji: '⚽', author: 'Emma, 5', gradient: 'from-green-400 to-blue-500' },
  { title: 'Space Explorer', emoji: '🚀', author: 'Lucas, 6', gradient: 'from-purple-500 to-indigo-600' },
  { title: 'Princess Castle', emoji: '🏰', author: 'Sophia, 4', gradient: 'from-pink-400 to-purple-500' },
  { title: 'Ocean Voyage', emoji: '🌊', author: 'Noah, 5', gradient: 'from-cyan-400 to-blue-600' },
  { title: 'Jungle Quest', emoji: '🦁', author: 'Ava, 6', gradient: 'from-green-500 to-emerald-600' },
  { title: 'Dinosaur Park', emoji: '🦕', author: 'Liam, 5', gradient: 'from-lime-400 to-green-600' },
  { title: 'Magic Garden', emoji: '🌸', author: 'Mia, 4', gradient: 'from-pink-300 to-rose-500' },
];

export default function CommunityStoriesCarousel() {
  const router = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stories, setStories] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkAuth();
  }, []);

  // Fetch featured stories
  useEffect(() => {
    async function fetchFeaturedStories() {
      try {
        const response = await fetch('/api/stories/public?limit=8&featured=true');
        if (!response.ok) {
          throw new Error('Failed to fetch stories');
        }
        const data = await response.json();

        if (data.stories && data.stories.length > 0) {
          setStories(data.stories);
        }
      } catch (err) {
        console.error('Error fetching featured stories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedStories();
  }, []);

  // Auto-scroll functionality
  useEffect(() => {
    if (isHovered || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // Auto-scroll every 4 seconds
    const interval = setInterval(() => {
      if (container.scrollLeft + clientWidth >= scrollWidth - 10) {
        // Reset to beginning with smooth scroll
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        // Scroll by one card width (~200px)
        container.scrollBy({ left: 200, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered, stories.length]);

  // Scroll navigation functions
  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -400, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 400, behavior: 'smooth' });
    }
  };

  // Handle card click - redirect to stories page
  const handleCardClick = () => {
    router.push('/stories');
  };

  // Determine which stories to display
  const displayStories = stories.length > 0 ? stories : MOCK_STORIES;
  const isMock = stories.length === 0;

  if (loading) {
    return (
      <div className="mb-10 sm:mb-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">
          ✨ Stories from Our Community
        </h2>
        <div className="animate-pulse flex gap-4 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-[150px] h-[150px] bg-gray-200 rounded-xl flex-shrink-0"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10 sm:mb-12">
      {/* Section Title */}
      <div className="text-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          ✨ Stories from Our Community
        </h2>
        <a
          href="/stories"
          className="text-indigo-600 hover:text-indigo-700 font-semibold text-sm transition-colors inline-flex items-center gap-1 group"
        >
          View All
          <span className="transform group-hover:translate-x-1 transition-transform">→</span>
        </a>
      </div>

      {/* Carousel Container */}
      <div
        className="relative group/carousel"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left Arrow */}
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity disabled:opacity-0"
          aria-label="Scroll left"
        >
          <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Scrollable Container */}
        <div
          ref={scrollContainerRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {displayStories.map((story, index) => (
            <StoryCarouselCard
              key={isMock ? index : (story as ProjectWithScenesDTO).id}
              story={story}
              variant="carousel"
              onClick={handleCardClick}
              isMock={isMock}
            />
          ))}
        </div>

        {/* Right Arrow */}
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
          aria-label="Scroll right"
        >
          <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>


      {/* Hide scrollbar styles */}
      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
