/**
 * Hero Carousel Component
 * Figma-style centered carousel with perspective effect
 * Center card is larger, side cards are smaller
 * Auto-rotates every 5 seconds with Figma-style controls at bottom right
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

// Mock story type for fallback
interface MockStory {
  title: string;
  emoji: string;
  author: string;
  gradient: string;
}

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

interface HeroCarouselProps {
  className?: string;
}

export default function HeroCarousel({ className = '' }: HeroCarouselProps) {
  const router = useRouter();
  const [stories, setStories] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch featured stories
  useEffect(() => {
    async function fetchFeaturedStories() {
      try {
        // Fetch public stories (remove featured filter to get more results)
        const response = await fetch('/api/stories/public?limit=8');
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

  // Determine display stories
  const displayStories = stories.length > 0 ? stories : MOCK_STORIES;
  const isMock = stories.length === 0;
  const totalStories = displayStories.length;

  // Navigate to next slide
  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % totalStories);
  }, [totalStories]);

  // Navigate to previous slide
  const goToPrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + totalStories) % totalStories);
  }, [totalStories]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (isPaused || totalStories === 0) return;

    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isPaused, totalStories, goToNext]);

  // Handle card click
  const handleCardClick = () => {
    router.push('/stories');
  };

  // Get position class for each card based on its distance from active
  const getCardStyle = (index: number): React.CSSProperties => {
    const diff = index - activeIndex;
    const normalizedDiff = ((diff + totalStories) % totalStories);

    // Calculate actual position (-2, -1, 0, 1, 2) for visible cards
    let position = normalizedDiff;
    if (normalizedDiff > totalStories / 2) {
      position = normalizedDiff - totalStories;
    }

    // Only show 5 cards (-2, -1, 0, 1, 2)
    if (Math.abs(position) > 2) {
      return {
        opacity: 0,
        transform: 'scale(0.5) translateX(0)',
        zIndex: 0,
        pointerEvents: 'none' as const,
      };
    }

    // Calculate scale and opacity based on position
    let scale: number;
    if (position === 0) {
      scale = 1;
    } else if (Math.abs(position) === 1) {
      scale = 0.85;
    } else {
      scale = 0.75;
    }

    const opacity = position === 0 ? 1 : 0.9 - Math.abs(position) * 0.05;

    // Position cards with visually even spacing
    // Outer cards should align with page content (max-w-6xl = 1152px, half = 576px)
    // Account for card width (240px * 0.75 scale = 180px, half = 90px)
    // So outer card center should be around 576 - 90 = ~486px from center
    let translateXPx: number;
    if (position === 0) {
      translateXPx = 0;
    } else if (Math.abs(position) === 1) {
      translateXPx = position * 268; // Adjacent cards
    } else {
      translateXPx = position * 238; // Outer cards - aligned with page edges
    }

    const zIndex = 10 - Math.abs(position);

    return {
      transform: `translateX(${translateXPx}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: 'all 0.5s ease-out',
    };
  };

  // Card dimensions - original sizes
  const getCenterCardSize = () => ({ width: 300, height: 400 });
  const getSideCardSize = () => ({ width: 240, height: 320 });

  // Render a single card
  const renderCard = (story: ProjectWithScenesDTO | MockStory, index: number, isMockStory: boolean) => {
    const style = getCardStyle(index);
    const isActive = index === activeIndex;
    const { width, height } = isActive ? getCenterCardSize() : getSideCardSize();

    if (isMockStory) {
      const mockStory = story as MockStory;
      return (
        <div
          key={index}
          className="absolute left-1/2 -translate-x-1/2 cursor-pointer transition-all duration-500"
          style={{ ...style, width: `${width}px`, height: `${height}px` }}
          onClick={handleCardClick}
        >
          <div className={`relative rounded-2xl overflow-hidden shadow-xl w-full h-full bg-gradient-to-br ${mockStory.gradient}`}>
            <div className="w-full h-full flex items-center justify-center">
              <span className={isActive ? 'text-8xl' : 'text-7xl'}>{mockStory.emoji}</span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <h3 className={`text-white font-bold ${isActive ? 'text-lg' : 'text-base'} line-clamp-1`}>
                {mockStory.title}
              </h3>
              <p className="text-white/80 text-sm line-clamp-1 mt-1">
                by {mockStory.author}
              </p>
            </div>
          </div>
        </div>
      );
    }

    const realStory = story as ProjectWithScenesDTO;
    const coverImage = realStory?.coverImageUrl || realStory?.scenes?.[0]?.imageUrl;
    const authorString = realStory?.authorName
      ? `${realStory.authorName}${realStory.authorAge ? `, ${realStory.authorAge}` : ''}`
      : 'A young storyteller';

    return (
      <div
        key={realStory.id}
        className="absolute left-1/2 -translate-x-1/2 cursor-pointer transition-all duration-500"
        style={{ ...style, width: `${width}px`, height: `${height}px` }}
        onClick={handleCardClick}
      >
        <div className="relative rounded-2xl overflow-hidden shadow-xl w-full h-full">
          {coverImage ? (
            <>
              <Image
                src={coverImage}
                alt={realStory.title || 'Story'}
                fill
                className="object-cover"
                sizes="300px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className={isActive ? 'text-8xl' : 'text-7xl'}>📖</span>
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className={`text-white font-bold ${isActive ? 'text-lg' : 'text-base'} line-clamp-1`}>
              {realStory.title || 'Untitled Story'}
            </h3>
            <p className="text-white/80 text-sm line-clamp-1 mt-1">
              by {authorString}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className={`relative h-[440px] ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse flex gap-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`bg-gray-200 rounded-2xl ${
                  i === 2 ? 'w-[300px] h-[400px]' : 'w-[240px] h-[320px]'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {/* Carousel Container */}
      <div className="relative h-[440px]">
        {/* Cards */}
        <div className="relative h-full w-full">
          {displayStories.map((story, index) => renderCard(story, index, isMock))}
        </div>

        {/* Figma-style Navigation Controls - Bottom right, aligned with right edge */}
        <div className="absolute bottom-4 right-8 flex items-center gap-2">
          {/* Previous Button */}
          <button
            onClick={goToPrev}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 bg-white/90 hover:bg-white transition-colors shadow-sm"
            aria-label="Previous story"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Pause/Play Button */}
          <button
            onClick={() => setIsPaused(!isPaused)}
            className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-gray-400 bg-white/90 hover:bg-white transition-colors shadow-sm"
            aria-label={isPaused ? 'Play' : 'Pause'}
          >
            {isPaused ? (
              <svg className="w-4 h-4 text-gray-700 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </button>

          {/* Next Button */}
          <button
            onClick={goToNext}
            className="w-9 h-9 flex items-center justify-center rounded-full border border-gray-300 bg-white/90 hover:bg-white transition-colors shadow-sm"
            aria-label="Next story"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
