/**
 * VideoCarousel Component
 * Horizontal scrollable carousel of YouTube video cards.
 * Shows thumbnails with play icons; clicking plays video inline.
 * Auto-scrolls like CommunityStoriesCarousel.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

interface VideoCarouselProps {
  videos: YouTubeVideo[];
}

export default function VideoCarousel({ videos }: VideoCarouselProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-scroll (pauses when hovered or a video is playing)
  useEffect(() => {
    if (isHovered || activeVideoId || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;

    const interval = setInterval(() => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        container.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: 420, behavior: 'smooth' });
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isHovered, activeVideoId, videos.length]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -420, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 420, behavior: 'smooth' });
  };

  const handlePlay = (videoId: string) => {
    setActiveVideoId(videoId);
  };

  const handleClose = () => {
    setActiveVideoId(null);
  };

  if (videos.length === 0) return null;

  return (
    <div
      className="relative group/carousel"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Arrow */}
      <button
        onClick={scrollLeft}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white shadow-lg rounded-full p-3 opacity-0 group-hover/carousel:opacity-100 transition-opacity"
        aria-label="Scroll left"
      >
        <svg className="w-5 h-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto scroll-smooth pb-2 flex gap-6"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {videos.map((video) => (
          <div
            key={video.videoId}
            className="flex-shrink-0 w-[300px] sm:w-[380px]"
          >
            {activeVideoId === video.videoId ? (
              /* Playing state: YouTube iframe */
              <div className="relative">
                <div className="aspect-video rounded-xl overflow-hidden shadow-lg">
                  <iframe
                    src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
                    title={video.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
                <button
                  onClick={handleClose}
                  className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm transition-colors"
                  aria-label="Close video"
                >
                  ×
                </button>
                <p className="mt-2 text-lg font-semibold text-gray-800 line-clamp-2 text-center">
                  {video.title}
                </p>
              </div>
            ) : (
              /* Thumbnail state: clickable card */
              <button
                onClick={() => handlePlay(video.videoId)}
                className="w-full text-left group/card"
                aria-label={`Play ${video.title}`}
              >
                <div className="relative aspect-video rounded-xl overflow-hidden shadow-md group-hover/card:shadow-xl transition-shadow">
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title}
                    className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/30 transition-colors flex items-center justify-center">
                    <div className="w-14 h-14 bg-white/90 group-hover/card:bg-white rounded-full flex items-center justify-center shadow-lg group-hover/card:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-red-600 ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-lg font-semibold text-gray-800 line-clamp-2 text-center group-hover/card:text-indigo-600 transition-colors">
                  {video.title}
                </p>
              </button>
            )}
          </div>
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

      {/* Hide scrollbar */}
      <style jsx>{`
        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
