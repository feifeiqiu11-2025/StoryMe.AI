/**
 * Story Carousel Card Component
 * Reusable card component for story showcase
 * Used in both hero slideshow and Netflix-style carousel
 */

'use client';

import Image from 'next/image';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

// Mock story type for fallback
export interface MockStory {
  title: string;
  emoji: string;
  author: string;
  gradient: string;
}

export interface StoryCarouselCardProps {
  story: ProjectWithScenesDTO | MockStory;
  variant?: 'hero' | 'carousel';
  onClick: () => void;
  isMock?: boolean;
}

export default function StoryCarouselCard({
  story,
  variant = 'carousel',
  onClick,
  isMock = false,
}: StoryCarouselCardProps) {
  // Determine size based on variant
  const heightClass = variant === 'hero' ? 'aspect-[5/3]' : 'h-[180px]';
  const containerClass = variant === 'hero' ? 'w-full max-w-md lg:max-w-lg' : 'w-[180px] flex-shrink-0';

  // Handle mock stories
  if (isMock) {
    const mockStory = story as MockStory;
    return (
      <div
        className={`${containerClass} cursor-pointer group`}
        onClick={onClick}
      >
        <div className={`relative rounded-xl overflow-hidden shadow-lg ${heightClass} hover:shadow-2xl transition-shadow`}>
          <div className={`bg-gradient-to-br ${mockStory.gradient} w-full h-full flex items-center justify-center transition-all duration-500`}>
            <span className={variant === 'hero' ? 'text-8xl' : 'text-5xl'}>
              {mockStory.emoji}
            </span>
          </div>

          {/* Story info overlay */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
            <h3 className={`text-white font-bold ${variant === 'hero' ? 'text-xl' : 'text-sm'} line-clamp-1`}>
              {mockStory.title}
            </h3>
            <p className={`text-white/90 ${variant === 'hero' ? 'text-base' : 'text-xs'} line-clamp-1 mt-1`}>
              by {mockStory.author}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Handle real stories
  const realStory = story as ProjectWithScenesDTO;
  const coverImage = realStory?.scenes?.[0]?.imageUrl;
  const sceneCount = realStory?.scenes?.length || 0;

  // Build author string
  const authorString = realStory?.authorName
    ? `${realStory.authorName}${realStory.authorAge ? `, ${realStory.authorAge}` : ''}`
    : 'A young storyteller';

  return (
    <div
      className={`${containerClass} cursor-pointer group`}
      onClick={onClick}
    >
      <div className={`relative rounded-xl overflow-hidden shadow-lg ${heightClass} hover:shadow-2xl transition-shadow`}>
        {coverImage ? (
          <div className="relative w-full h-full">
            <Image
              src={coverImage}
              alt={realStory.title || 'Story'}
              fill
              className="object-cover transition-opacity duration-500"
              sizes={variant === 'hero' ? '(max-width: 1024px) 100vw, 512px' : '200px'}
              loading={variant === 'carousel' ? 'lazy' : 'eager'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-500 to-purple-600 w-full h-full flex items-center justify-center">
            <span className={variant === 'hero' ? 'text-8xl' : 'text-5xl'}>📖</span>
          </div>
        )}

        {/* Story info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className={`text-white font-bold ${variant === 'hero' ? 'text-xl' : 'text-sm'} line-clamp-1`}>
            {realStory.title || 'Untitled Story'}
          </h3>
          <div className="flex items-center justify-between mt-1">
            <p className={`text-white/90 ${variant === 'hero' ? 'text-base' : 'text-xs'} line-clamp-1`}>
              by {authorString}
            </p>
            {variant === 'hero' && sceneCount > 0 && (
              <p className="text-white/80 text-sm">
                {sceneCount} scene{sceneCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
