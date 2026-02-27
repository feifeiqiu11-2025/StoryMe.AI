/**
 * VideoShowcase Component
 * Large video display with text alongside, dot pagination, and auto-flip.
 * Used for "Our Stories" (video-left) and "Watch How It Works" (video-right).
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

interface VideoShowcaseProps {
  videos: YouTubeVideo[];
  title: string;
  introText: string;
  layout: 'video-left' | 'video-right';
}

export default function VideoShowcase({
  videos,
  title,
  introText,
  layout,
}: VideoShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentVideo = videos[activeIndex];

  const goToIndex = useCallback(
    (index: number) => {
      if (index === activeIndex) return;
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex(index);
        setIsPlaying(false);
        setIsTransitioning(false);
      }, 200);
    },
    [activeIndex]
  );

  // Auto-flip every 5 seconds, pause when video is playing
  useEffect(() => {
    if (isPlaying || videos.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % videos.length);
        setIsTransitioning(false);
      }, 200);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, videos.length]);

  if (videos.length === 0) return null;

  const videoSide = (
    <div className="w-full md:w-[55%] flex-shrink-0">
      {/* Video area */}
      <div
        className={`transition-opacity duration-200 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        {isPlaying ? (
          <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg">
            <iframe
              src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1`}
              title={currentVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full border-0"
            />
            <button
              onClick={() => setIsPlaying(false)}
              className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
              aria-label="Close video"
            >
              x
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsPlaying(true)}
            className="w-full text-left group/card"
            aria-label={`Play ${currentVideo.title}`}
          >
            <div className="relative aspect-video rounded-xl overflow-hidden shadow-lg group-hover/card:shadow-xl transition-shadow">
              <img
                src={currentVideo.thumbnailUrl}
                alt={currentVideo.title}
                className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/30 transition-colors flex items-center justify-center">
                <div className="w-16 h-16 bg-white/90 group-hover/card:bg-white rounded-full flex items-center justify-center shadow-lg group-hover/card:scale-110 transition-transform">
                  <svg
                    className="w-7 h-7 text-red-600 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          </button>
        )}
      </div>

      {/* Dot pagination */}
      {videos.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => goToIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === activeIndex
                  ? 'bg-purple-600 scale-110'
                  : 'bg-gray-300 hover:bg-gray-400'
              }`}
              aria-label={`Go to video ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );

  const textSide = (
    <div className="w-full md:w-[45%] flex flex-col justify-center">
      <p className="text-lg sm:text-xl text-gray-700 leading-relaxed mb-8">{introText}</p>
      <div
        className={`transition-opacity duration-200 border-l-4 border-purple-400 pl-4 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}
      >
        <p className="text-xs font-medium text-purple-500 uppercase tracking-wide mb-1">
          Now Playing
        </p>
        <p className="text-base font-semibold text-gray-800">
          {currentVideo.title}
        </p>
        {currentVideo.description && (
          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
            {currentVideo.description}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="mb-12 sm:mb-16">
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          {title}
        </h2>
      </div>
      <div
        className={`flex flex-col md:flex-row gap-8 md:gap-12 items-center ${
          layout === 'video-right' ? 'md:flex-row-reverse' : ''
        }`}
      >
        {videoSide}
        {textSide}
      </div>
    </div>
  );
}
