/**
 * Testimonials Component
 * Continuous scrolling marquee mixing text testimonials and video testimonials.
 * Full-width, no pagination, pauses on hover.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

interface Testimonial {
  id: string;
  rating: number;
  feedback_text: string | null;
  display_name: string | null;
  created_at: string;
  is_featured: boolean;
}

type CarouselItem =
  | { type: 'text'; data: Testimonial }
  | { type: 'video'; data: YouTubeVideo };

interface TestimonialsProps {
  videoTestimonials?: YouTubeVideo[];
}

export default function Testimonials({ videoTestimonials = [] }: TestimonialsProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const marqueeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTestimonials();
  }, []);

  async function fetchTestimonials() {
    try {
      const response = await fetch('/api/testimonials');
      const data = await response.json();

      if (response.ok) {
        setTestimonials(data.testimonials || []);
      }
    } catch (error) {
      console.error('Error fetching testimonials:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filter text testimonials: only keep those with actual feedback text
  const textItems: CarouselItem[] = testimonials
    .filter((t) => t.feedback_text && t.feedback_text.trim().length > 0)
    .map((t) => ({ type: 'text', data: t }));

  const videoItems: CarouselItem[] = videoTestimonials.map((v) => ({
    type: 'video',
    data: v,
  }));

  // Interleave text and video items
  const items: CarouselItem[] = [];
  const maxLen = Math.max(textItems.length, videoItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < textItems.length) items.push(textItems[i]);
    if (i < videoItems.length) items.push(videoItems[i]);
  }

  // Don't render if no content
  if (!loading && items.length === 0) {
    return null;
  }

  return (
    <section className="py-10 bg-gradient-to-b from-white to-blue-50 overflow-hidden">
      {/* Section Header */}
      <div className="text-center mb-8 px-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Voice from Our Little Creators
        </h2>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 mt-4">Loading testimonials...</p>
        </div>
      ) : (
        <div
          ref={marqueeRef}
          className="relative w-full"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <div
            className="flex gap-5 w-max"
            style={{
              animation: `marquee-scroll ${items.length * 8}s linear infinite`,
              animationPlayState: isPaused ? 'paused' : 'running',
            }}
          >
            {/* Render items twice for seamless loop */}
            {[...items, ...items].map((item, i) => (
              <div key={i} className="w-[280px] flex-shrink-0">
                {item.type === 'text' ? (
                  <TextCard testimonial={item.data} />
                ) : (
                  <VideoCard video={item.data} />
                )}
              </div>
            ))}
          </div>

          {/* CSS animation */}
          <style jsx>{`
            @keyframes marquee-scroll {
              0% {
                transform: translateX(0);
              }
              100% {
                transform: translateX(-50%);
              }
            }
          `}</style>
        </div>
      )}
    </section>
  );
}

/** Text testimonial card */
function TextCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <div className="bg-white rounded-xl shadow-md p-5 h-[220px] flex flex-col">
      {/* Star Rating */}
      <div className="flex gap-0.5 mb-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className="w-4 h-4"
            fill={star <= testimonial.rating ? '#FCD34D' : '#E5E7EB'}
            stroke={star <= testimonial.rating ? '#F59E0B' : '#9CA3AF'}
            strokeWidth="1"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>

      {/* Feedback Text */}
      <blockquote className="text-gray-700 text-sm italic leading-relaxed flex-1 line-clamp-4">
        &ldquo;{testimonial.feedback_text}&rdquo;
      </blockquote>

      {/* Author */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 mt-auto">
        <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full flex items-center justify-center text-white font-bold text-xs">
          {testimonial.display_name?.[0]?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-semibold text-gray-900 text-xs">
            {testimonial.display_name || 'Anonymous'}
          </p>
          <p className="text-[10px] text-gray-500">KindleWood Parent</p>
        </div>
      </div>
    </div>
  );
}

/** Video testimonial card */
function VideoCard({ video }: { video: YouTubeVideo }) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden h-[220px] flex flex-col">
      {isPlaying ? (
        <div className="relative flex-1">
          <iframe
            src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full border-0"
          />
          <button
            onClick={() => setIsPlaying(false)}
            className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
            aria-label="Close video"
          >
            x
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsPlaying(true)}
          className="w-full text-left group/card flex-1 relative"
          aria-label={`Play ${video.title}`}
        >
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-full h-full object-cover group-hover/card:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/20 group-hover/card:bg-black/30 transition-colors flex items-center justify-center">
            <div className="w-10 h-10 bg-white/90 group-hover/card:bg-white rounded-full flex items-center justify-center shadow-lg group-hover/card:scale-110 transition-transform">
              <svg
                className="w-4 h-4 text-red-600 ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </button>
      )}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-800 line-clamp-1">
          {video.title}
        </p>
      </div>
    </div>
  );
}
