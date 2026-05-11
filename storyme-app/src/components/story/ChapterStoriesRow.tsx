/**
 * Chapter Stories row — community-feed section that showcases multi-
 * chapter and continuous-narrative stories.
 *
 * Includes:
 *   - Real chapter_book projects (Tiptap doc, /chapter-books/[id]/read)
 *   - Picture-book projects tagged "chapterbook" (kids think of a
 *     continuing picture-book series as a chapter book too)
 *
 * Layout: horizontal scroll-snap row, same card size as the main grid
 * (smaller than Featured Stories). No auto-advance — kid drives the
 * scroll. Lazy-loads 6 stories at a time via an IntersectionObserver
 * sentinel parked at the right edge of the scroller, so the row scales
 * to N stories without mounting them all upfront.
 *
 * Hidden entirely when the merged result is empty (no "coming soon"
 * placeholder).
 */

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';
import type { StoryTag } from '@/lib/types/story';

interface ChapterStory extends StoryCardData {
  publishedAt?: string;
  tags?: StoryTag[];
}

interface ChapterStoriesRowProps {
  onStoryClick: (
    storyId: string,
    projectType?: 'picture_book' | 'chapter_book'
  ) => void;
}

/** How many stories we fetch per page. Matches the rough number of
 *  cards visible on a desktop row so the kid sees one new "screenful"
 *  per lazy-load fetch. */
const PAGE_SIZE = 6;

export default function ChapterStoriesRow({ onStoryClick }: ChapterStoriesRowProps) {
  const [stories, setStories] = useState<ChapterStory[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on each fetch so out-of-order responses (e.g., second
  // page returning before first) don't clobber newer state.
  const requestKey = useRef(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useRef(false);

  // Initial fetch.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      reducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    const myKey = ++requestKey.current;
    const fetchInitial = async () => {
      try {
        const res = await fetch(
          `/api/stories/public?chapterStoriesOnly=true&limit=${PAGE_SIZE}&offset=0`
        );
        const data = await res.json();
        if (myKey !== requestKey.current) return;
        if (res.ok && Array.isArray(data.stories)) {
          setStories(data.stories);
          setHasMore(data.stories.length === PAGE_SIZE && data.totalCount > PAGE_SIZE);
        } else {
          throw new Error(data.error || 'Failed to load chapter stories');
        }
      } catch (err) {
        if (myKey !== requestKey.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        if (myKey === requestKey.current) setLoading(false);
      }
    };
    void fetchInitial();
  }, []);

  /** Pull the next page of chapter stories. Triggered by the
   *  right-edge IntersectionObserver sentinel below. */
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const myKey = ++requestKey.current;
    try {
      const offset = stories.length;
      const res = await fetch(
        `/api/stories/public?chapterStoriesOnly=true&limit=${PAGE_SIZE}&offset=${offset}`
      );
      const data = await res.json();
      if (myKey !== requestKey.current) return;
      if (res.ok && Array.isArray(data.stories)) {
        setStories((prev) => [...prev, ...data.stories]);
        setHasMore(
          data.stories.length === PAGE_SIZE &&
            stories.length + data.stories.length < data.totalCount
        );
      } else {
        setHasMore(false);
      }
    } catch (err) {
      if (myKey !== requestKey.current) return;
      console.warn('Chapter stories load-more failed:', err);
      setHasMore(false);
    } finally {
      if (myKey === requestKey.current) setLoadingMore(false);
    }
  }, [stories.length, hasMore, loadingMore]);

  /** Kid-controlled prev/next button handlers. Mirrors the pattern in
   *  FeaturedStoriesCarousel but without auto-advance. */
  const cardStep = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const card = el.querySelector('[data-chapter-card]') as HTMLElement | null;
    if (!card) return el.clientWidth;
    return card.offsetWidth + 16; // gap-4
  }, []);

  const advance = useCallback(
    (direction: 1 | -1) => {
      const el = scrollerRef.current;
      if (!el) return;
      el.scrollBy({
        left: direction * cardStep(),
        behavior: reducedMotion.current ? 'auto' : 'smooth',
      });
    },
    [cardStep]
  );

  const visibleStories = useMemo(() => stories, [stories]);

  // Loading skeleton — same row geometry so the page doesn't jump
  // when the real cards arrive.
  if (loading) {
    return (
      <section aria-label="Chapter stories" className="mb-6">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-3">
          Chapter Stories
        </h2>
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-[260px] sm:w-[270px] lg:w-[290px] xl:w-[280px] bg-white rounded-xl shadow-md overflow-hidden animate-pulse"
            >
              <div className="aspect-square bg-gray-200" />
              <div className="px-3 py-2.5 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error || visibleStories.length === 0) return null;

  return (
    <section aria-label="Chapter stories" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">
          Chapter Stories
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => advance(-1)}
            aria-label="Previous chapter stories"
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => advance(1)}
            aria-label="Next chapter stories"
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
        {visibleStories.map((story) => (
          <div
            key={story.id}
            data-chapter-card
            className="flex-shrink-0 snap-start w-[260px] sm:w-[270px] lg:w-[290px] xl:w-[280px]"
          >
            <StoryCard
              story={story}
              onClick={() => onStoryClick(story.id, story.projectType)}
              variant="community"
              showFeaturedBadge={true}
              showViewCount={true}
              showAuthor={true}
            />
          </div>
        ))}
        {/* Right-edge sentinel — kicks off the next batch when the kid
            scrolls within a card-width of the end. rootMargin pre-loads
            so the next batch lands before the kid hits actual edge. */}
        {hasMore && (
          <RightEdgeSentinel
            onIntersect={loadMore}
            loading={loadingMore}
          />
        )}
      </div>
    </section>
  );
}

/**
 * Vertical-strip element parked at the right end of the horizontal
 * scroller. IntersectionObserver fires when the strip enters the
 * scroller's viewport, which is the kid getting close to the end.
 *
 * The 200px rootMargin in the horizontal axis pre-loads one card-width
 * ahead so the next page is ready by the time the kid scrolls to it.
 */
function RightEdgeSentinel({
  onIntersect,
  loading,
}: {
  onIntersect: () => void;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const cb = useRef(onIntersect);
  cb.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      // root: undefined = viewport. The scroller is x-overflow inside
      // the viewport, so the sentinel is technically in viewport flow.
      // rootMargin pre-loads when sentinel is within ~one card-width
      // of the right edge of the visible area.
      { rootMargin: '0px 200px 0px 0px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="flex-shrink-0 flex items-center justify-center w-[40px]"
      aria-hidden
    >
      {loading ? (
        <div
          className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"
          role="status"
          aria-label="Loading more chapter stories"
        />
      ) : (
        <span className="block w-px h-px" />
      )}
    </div>
  );
}
