'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

// Mock stories for when no real stories exist
const MOCK_STORIES = [
  { title: 'Dragon Adventure', emoji: '🐉', author: 'Connor, 4 years old', gradient: 'from-orange-400 to-red-500' },
  { title: 'Fun Soccer Time', emoji: '⚽', author: 'Emma, 5 years old', gradient: 'from-green-400 to-blue-500' },
  { title: 'Space Explorer', emoji: '🚀', author: 'Lucas, 6 years old', gradient: 'from-purple-500 to-indigo-600' },
  { title: 'Princess Castle', emoji: '🏰', author: 'Sophia, 4 years old', gradient: 'from-pink-400 to-purple-500' },
  { title: 'Ocean Voyage', emoji: '🌊', author: 'Noah, 5 years old', gradient: 'from-cyan-400 to-blue-600' },
];

export default function HeroStoryShowcase() {
  const router = useRouter();
  const [stories, setStories] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [user, setUser] = useState<any>(null);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    async function fetchFeaturedStories() {
      try {
        const response = await fetch('/api/stories/public?limit=5&featured=true');
        if (!response.ok) {
          throw new Error('Failed to fetch stories');
        }
        const data = await response.json();

        // Get up to 5 stories for the slideshow
        if (data.projects && data.projects.length > 0) {
          setStories(data.projects);
        }
      } catch (err) {
        console.error('Error fetching featured stories:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchFeaturedStories();
  }, []);

  // Auto-rotate slideshow every 3 seconds
  useEffect(() => {
    const totalSlides = stories.length > 0 ? stories.length : MOCK_STORIES.length;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 3000);

    return () => clearInterval(interval);
  }, [stories.length]);

  if (loading) {
    return (
      <div className="lg:block hidden">
        <div className="animate-pulse bg-gray-200 rounded-2xl w-full max-w-md lg:max-w-lg aspect-[4/3]"></div>
      </div>
    );
  }

  // Show mock stories slideshow if no real stories
  if (stories.length === 0) {
    const currentMock = MOCK_STORIES[currentIndex];

    return (
      <div className="lg:flex lg:flex-col lg:items-center hidden">
        <div className="relative w-full max-w-md lg:max-w-lg">
          {/* Main story card - Reduced height for better proportion */}
          <Link href={user ? "/community-stories" : "/stories"} className="block">
            <div className="relative rounded-2xl overflow-hidden shadow-xl w-full aspect-[5/3] cursor-pointer hover:shadow-2xl transition-shadow">
              <div className={`bg-gradient-to-br ${currentMock.gradient} w-full h-full flex items-center justify-center transition-all duration-500`}>
                <span className="text-8xl">{currentMock.emoji}</span>
              </div>

              {/* Story info overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
                <h3 className="text-white font-bold text-xl">{currentMock.title}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl">👦</span>
                  <p className="text-white/90 text-base">by {currentMock.author}</p>
                </div>
              </div>

              {/* Navigation dots overlay on image */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                {MOCK_STORIES.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentIndex(idx);
                    }}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      idx === currentIndex
                        ? 'w-8 bg-white'
                        : 'w-2 bg-white/50 hover:bg-white/75'
                    }`}
                    aria-label={`Go to slide ${idx + 1}`}
                  />
                ))}
              </div>
            </div>
          </Link>

          {/* Title below slideshow - matching Create Account button font */}
          <p className="text-gray-800 font-semibold text-base text-center mt-3">
            ✨ Stories shared from communities
          </p>
        </div>
      </div>
    );
  }

  // Show real saved stories slideshow
  const currentStory = stories[currentIndex];
  const coverImage = currentStory?.scenes?.[0]?.imageUrl;
  const sceneCount = currentStory?.scenes?.length || 0;

  // Build author string from story data
  const authorString = currentStory?.authorName
    ? `${currentStory.authorName}${currentStory.authorAge ? `, ${currentStory.authorAge} years old` : ''}`
    : 'A young storyteller';

  return (
    <div className="lg:flex lg:flex-col lg:items-center hidden">
      <div className="relative w-full max-w-md lg:max-w-lg">
        {/* Main story card - Reduced height for better proportion */}
        <Link href={user ? "/community-stories" : "/stories"} className="block">
          <div className="relative rounded-2xl overflow-hidden shadow-xl w-full aspect-[5/3] cursor-pointer hover:shadow-2xl transition-shadow">
            {coverImage ? (
              <div className="relative w-full h-full">
                <Image
                  src={coverImage}
                  alt={currentStory.title || 'Story'}
                  fill
                  className="object-cover transition-opacity duration-500"
                  priority
                  sizes="(max-width: 1024px) 100vw, 512px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-full h-full flex items-center justify-center">
                <span className="text-8xl">📖</span>
              </div>
            )}

            {/* Story info overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white font-bold text-xl line-clamp-1">
                {currentStory.title || 'Untitled Story'}
              </h3>
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">👦</span>
                  <p className="text-white/90 text-base">by {authorString}</p>
                </div>
                {sceneCount > 0 && (
                  <p className="text-white/80 text-sm">
                    {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>

            {/* Navigation dots overlay on image */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
              {stories.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentIndex(idx);
                  }}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    idx === currentIndex
                      ? 'w-8 bg-white'
                      : 'w-2 bg-white/50 hover:bg-white/75'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </Link>

        {/* Title below slideshow - matching Create Account button font */}
        <p className="text-gray-800 font-semibold text-base text-center mt-3">
          ✨ Stories shared from communities
        </p>
      </div>
    </div>
  );
}
