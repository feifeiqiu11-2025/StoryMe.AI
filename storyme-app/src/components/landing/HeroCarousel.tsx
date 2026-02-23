/**
 * Hero Carousel Component
 * Figma-style centered carousel with perspective effect
 * Center card is larger, side cards are smaller
 * Auto-rotates every 5 seconds with Figma-style controls at bottom right
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
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

// Messages for typing effect
const MAIN_MESSAGE = "Turn Your Child's Ideas Into Creations They Can Learn From";
const SUB_MESSAGE = "A story, a drawing, a 3D model, and more—brought to life by their imagination.";

export default function HeroCarousel({ className = '' }: HeroCarouselProps) {
  const router = useRouter();
  const [stories, setStories] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Auth state for CTA button
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Typing effect state
  const [displayedText, setDisplayedText] = useState('');
  const [typingComplete, setTypingComplete] = useState(false);
  const [subDisplayedText, setSubDisplayedText] = useState('');
  const [subTypingComplete, setSubTypingComplete] = useState(false);

  // Check if user is logged in
  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkAuth();
  }, []);

  // Main message typing effect - complete in ~2.5 seconds
  useEffect(() => {
    if (typingComplete) return;

    const totalChars = MAIN_MESSAGE.length;
    // ~2.5 seconds to type main message
    const intervalTime = Math.floor(2500 / totalChars);

    const timer = setInterval(() => {
      setDisplayedText(prev => {
        if (prev.length >= MAIN_MESSAGE.length) {
          clearInterval(timer);
          setTypingComplete(true);
          return MAIN_MESSAGE;
        }
        return MAIN_MESSAGE.slice(0, prev.length + 1);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [typingComplete]);

  // Sub message typing effect - starts after main message, complete in ~2 seconds
  useEffect(() => {
    if (!typingComplete || subTypingComplete) return;

    const totalChars = SUB_MESSAGE.length;
    // ~2 seconds to type sub message
    const intervalTime = Math.floor(2000 / totalChars);

    const timer = setInterval(() => {
      setSubDisplayedText(prev => {
        if (prev.length >= SUB_MESSAGE.length) {
          clearInterval(timer);
          setSubTypingComplete(true);
          return SUB_MESSAGE;
        }
        return SUB_MESSAGE.slice(0, prev.length + 1);
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [typingComplete, subTypingComplete]);

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

  // Track viewport width for responsive card positioning
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Get position class for each card based on its distance from active
  const getCardStyle = (index: number): React.CSSProperties => {
    const diff = index - activeIndex;
    const normalizedDiff = ((diff + totalStories) % totalStories);

    // Calculate actual position (-2, -1, 0, 1, 2) for visible cards
    let position = normalizedDiff;
    if (normalizedDiff > totalStories / 2) {
      position = normalizedDiff - totalStories;
    }

    // Responsive: On mobile (< 640px) only show 3 cards, on tablet (< 1024px) show 5 but tighter
    const isMobile = viewportWidth < 640;
    const isTablet = viewportWidth < 1024;
    const maxVisiblePosition = isMobile ? 1 : 2;

    // Hide cards beyond visible range
    if (Math.abs(position) > maxVisiblePosition) {
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
      scale = isMobile ? 0.9 : 1;
    } else if (Math.abs(position) === 1) {
      scale = isMobile ? 0.7 : 0.85;
    } else {
      scale = 0.75;
    }

    const opacity = position === 0 ? 1 : 0.9 - Math.abs(position) * 0.05;

    // Responsive spacing - use viewport-relative values
    let translateXPx: number;
    if (position === 0) {
      translateXPx = 0;
    } else if (Math.abs(position) === 1) {
      // Adjacent cards - responsive spacing
      if (isMobile) {
        translateXPx = position * 130; // Tighter on mobile
      } else if (isTablet) {
        translateXPx = position * 200; // Medium on tablet
      } else {
        translateXPx = position * 268; // Full on desktop
      }
    } else {
      // Outer cards (position ±2) - only shown on larger screens
      if (isTablet) {
        translateXPx = position * 180;
      } else {
        translateXPx = position * 238;
      }
    }

    const zIndex = 10 - Math.abs(position);

    return {
      transform: `translateX(${translateXPx}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: 'all 0.5s ease-out',
    };
  };

  // Card dimensions - responsive sizes
  const getCenterCardSize = () => {
    if (viewportWidth < 640) return { width: 200, height: 280 }; // Mobile
    if (viewportWidth < 1024) return { width: 260, height: 360 }; // Tablet
    return { width: 300, height: 400 }; // Desktop
  };
  const getSideCardSize = () => {
    if (viewportWidth < 640) return { width: 160, height: 220 }; // Mobile
    if (viewportWidth < 1024) return { width: 200, height: 280 }; // Tablet
    return { width: 240, height: 320 }; // Desktop
  };

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
      <div className={`relative h-[320px] sm:h-[380px] lg:h-[440px] ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-pulse flex gap-2 sm:gap-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className={`bg-gray-200 rounded-2xl ${
                  i === 1
                    ? 'w-[200px] h-[280px] sm:w-[260px] sm:h-[360px] lg:w-[300px] lg:h-[400px]'
                    : 'w-[160px] h-[220px] sm:w-[200px] sm:h-[280px] lg:w-[240px] lg:h-[320px]'
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
      <div className="relative h-[320px] sm:h-[380px] lg:h-[440px]">
        {/* Cards */}
        <div className="relative h-full w-full">
          {displayStories.map((story, index) => renderCard(story, index, isMock))}
        </div>

        {/* Overlay with Typing Effect */}
        <div className="absolute inset-0 flex items-end justify-center z-20 pointer-events-none pb-3 px-2 sm:px-4">
          <div className="bg-white/65 backdrop-blur-sm rounded-xl px-3 sm:px-5 py-3 max-w-[calc(100%-1rem)] sm:max-w-xl md:max-w-2xl lg:max-w-3xl text-center shadow-lg pointer-events-auto">
            {/* Main Message with Typing Effect */}
            <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-gray-900 mb-0.5 leading-tight">
              {displayedText}
              {!typingComplete && (
                <span className="inline-block w-0.5 h-4 sm:h-5 bg-blue-600 ml-1 animate-pulse" />
              )}
            </h2>

            {/* Sub Message with Typing Effect */}
            <p className="text-gray-600 text-xs sm:text-sm md:text-base mb-2 leading-tight">
              {subDisplayedText}
              {typingComplete && !subTypingComplete && (
                <span className="inline-block w-0.5 h-3 sm:h-4 bg-blue-600 ml-1 animate-pulse" />
              )}
            </p>

            {/* CTA Button */}
            {!isMounted ? (
              <div className="inline-block px-5 py-2 opacity-0">Start to Create</div>
            ) : (
              <Link
                href={isLoggedIn ? '/dashboard' : '/signup'}
                className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                Start to Create
              </Link>
            )}
          </div>
        </div>

        {/* Figma-style Navigation Controls - Bottom right, aligned with right edge */}
        <div className="absolute bottom-4 right-8 flex items-center gap-2 z-30">
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
