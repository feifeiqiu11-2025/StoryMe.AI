/**
 * Featured Stories Carousel (Community Stories page)
 * Horizontal scroll-snap row of featured stories with gentle auto-advance.
 * Reuses <StoryCard /> sized slightly larger than the grid below.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';
import type { StoryTag } from '@/lib/types/story';

interface FeaturedStory extends StoryCardData {
  publishedAt?: string;
  tags?: StoryTag[];
}

interface FeaturedStoriesCarouselProps {
  onStoryClick: (storyId: string) => void;
}

const AUTO_ADVANCE_MS = 4000;

export default function FeaturedStoriesCarousel({ onStoryClick }: FeaturedStoriesCarouselProps) {
  const [stories, setStories] = useState<FeaturedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch('/api/stories/public?featuredOnly=true&limit=24');
        const data = await res.json();
        if (res.ok && Array.isArray(data.stories)) {
          setStories(data.stories);
        }
      } catch (err) {
        console.error('Error fetching featured stories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFeatured();

    if (typeof window !== 'undefined' && window.matchMedia) {
      reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  }, []);

  const cardStep = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const card = el.querySelector('[data-carousel-card]') as HTMLElement | null;
    if (!card) return el.clientWidth;
    // Step by one card + gap (gap-4 = 16px)
    return card.offsetWidth + 16;
  }, []);

  const advance = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = cardStep();
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    const atStart = el.scrollLeft <= 4;

    if (direction === 1 && atEnd) {
      el.scrollTo({ left: 0, behavior: reducedMotion.current ? 'auto' : 'smooth' });
    } else if (direction === -1 && atStart) {
      el.scrollTo({ left: el.scrollWidth, behavior: reducedMotion.current ? 'auto' : 'smooth' });
    } else {
      el.scrollBy({ left: direction * step, behavior: reducedMotion.current ? 'auto' : 'smooth' });
    }
  }, [cardStep]);

  // Auto-advance loop — paused on hover/touch/focus and when reduced motion is on.
  useEffect(() => {
    if (loading || stories.length <= 1 || paused || reducedMotion.current) return;
    const id = window.setInterval(() => advance(1), AUTO_ADVANCE_MS);
    return () => window.clearInterval(id);
  }, [loading, stories.length, paused, advance]);

  if (loading) {
    return (
      <section aria-label="Featured stories" className="mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4">Featured Stories</h2>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[calc((100%-16px)/1.5)] lg:w-[calc((100%-32px)/2.5)] xl:w-[calc((100%-48px)/3.5)] max-w-[360px] bg-white rounded-xl shadow-lg overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-gray-200" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (stories.length === 0) return null;

  return (
    <section
      aria-label="Featured stories"
      className="mb-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">Featured Stories</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => advance(-1)}
            aria-label="Previous featured stories"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            aria-label="Next featured stories"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {stories.map((story) => (
          <div
            key={story.id}
            data-carousel-card
            className="flex-shrink-0 snap-start w-[calc((100%-16px)/1.5)] lg:w-[calc((100%-32px)/2.5)] xl:w-[calc((100%-48px)/3.5)] max-w-[360px]"
          >
            <StoryCard
              story={story}
              onClick={() => onStoryClick(story.id)}
              variant="community"
              showFeaturedBadge={true}
              showViewCount={true}
              showAuthor={true}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
