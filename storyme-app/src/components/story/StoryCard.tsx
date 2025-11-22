/**
 * Shared StoryCard Component
 * Reusable card component for displaying stories across the application
 * Used in: My Stories, Community Stories, Mobile App, etc.
 */

'use client';

import React, { useState } from 'react';

import type { StoryTag } from '@/lib/types/story';

export interface StoryCardData {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  authorName?: string;
  authorAge?: number;
  viewCount?: number;
  featured?: boolean;
  visibility?: 'public' | 'private';
  sceneCount?: number;
  createdAt?: string;
  tags?: StoryTag[]; // NEW: Story tags
  // Fallback for legacy data
  scenes?: Array<{
    imageUrl?: string | null;
    images?: Array<{ imageUrl?: string }>;
  }>;
}

export interface StoryCardProps {
  story: StoryCardData;
  onClick: () => void;
  variant?: 'community' | 'myStories';
  showPrivacyBadge?: boolean;
  showViewCount?: boolean;
  showFeaturedBadge?: boolean;
  showAuthor?: boolean;
  showSceneCount?: boolean;
  showDate?: boolean;
  showShareButton?: boolean;
  onPrivacyToggle?: (storyId: string, currentVisibility: 'public' | 'private') => void;
  onDelete?: (storyId: string) => void;
  isUpdatingPrivacy?: boolean;
}

export function StoryCard({
  story,
  onClick,
  variant = 'community',
  showPrivacyBadge = variant === 'myStories',
  showViewCount = true,
  showFeaturedBadge = true,
  showAuthor = variant === 'community',
  showSceneCount = variant === 'myStories',
  showDate = variant === 'myStories',
  showShareButton = variant === 'community',
  onPrivacyToggle,
  onDelete,
  isUpdatingPrivacy = false,
}: StoryCardProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/stories/${story.id}?mode=reading`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };
  // Get cover image with fallback
  const coverImage =
    story.coverImageUrl ||
    story.scenes?.[0]?.images?.[0]?.imageUrl ||
    story.scenes?.[0]?.imageUrl;

  const isPublic = story.visibility === 'public';
  const viewCount = story.viewCount || 0;

  // Format date for My Stories
  const formattedDate = story.createdAt
    ? new Date(story.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer"
    >
      {/* Cover Image - Square aspect ratio for better space usage */}
      <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-purple-100">
        {coverImage ? (
          <img
            src={coverImage}
            alt={story.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">📖</span>
          </div>
        )}

        {/* Top Left - Privacy Badge (My Stories only) */}
        {showPrivacyBadge && (
          <div className="absolute top-2 left-2">
            {isPublic ? (
              <div className="flex items-center gap-1 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                <span>🌍</span>
                <span>Public</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-gray-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                <span>🔒</span>
                <span>Private</span>
              </div>
            )}
          </div>
        )}

        {/* Top Right - Featured Badge */}
        {showFeaturedBadge && story.featured && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
            ⭐ Featured
          </div>
        )}

        {/* Bottom Left - View Count */}
        {showViewCount && viewCount > 0 && (
          <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-3 py-1 rounded-full text-xs font-medium">
            👁️ {viewCount}
          </div>
        )}

        {/* Bottom Right - Share Button */}
        {showShareButton && isPublic && (
          <div className="absolute bottom-2 right-2">
            {copied && (
              <div className="absolute bottom-full right-0 mb-2 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap z-10">
                <div className="font-medium mb-0.5">Link copied!</div>
                <div className="text-gray-400 text-[10px] truncate max-w-[160px]">
                  ...stories/{story.id}?mode=reading
                </div>
                <div className="absolute bottom-0 right-3 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
              </div>
            )}
            <button
              onClick={handleShare}
              className={`${copied ? 'bg-green-500' : 'bg-black bg-opacity-50 hover:bg-opacity-70'} text-white p-2 rounded-full transition-all`}
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Story Info */}
      <div className="p-4">
        {/* Title */}
        <h3 className="font-bold text-gray-900 text-lg mb-1 line-clamp-2">
          {story.title}
        </h3>

        {/* Meta Info (Scene Count + Date for My Stories) */}
        {(showSceneCount || showDate) && (
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            {showSceneCount && story.sceneCount && (
              <>
                <span>{story.sceneCount} scenes</span>
                {showDate && formattedDate && <span>•</span>}
              </>
            )}
            {showDate && formattedDate && <span>{formattedDate}</span>}
          </div>
        )}

        {/* Tags (NEW) */}
        {story.tags && story.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {story.tags.slice(0, 2).map(tag => (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-medium"
              >
                {tag.icon && <span className="text-sm">{tag.icon}</span>}
                {tag.name}
              </span>
            ))}
            {story.tags.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">
                +{story.tags.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Description */}
        {story.description && (
          <p className="text-gray-600 text-sm mb-2 line-clamp-2">
            {story.description}
          </p>
        )}

        {/* Author Info (Community Stories) */}
        {showAuthor && story.authorName && (
          <p className="text-xs text-gray-500 italic">
            by {story.authorName}
            {story.authorAge && `, age ${story.authorAge}`}
          </p>
        )}

        {/* Action Buttons (My Stories only) */}
        {variant === 'myStories' && (onPrivacyToggle || onDelete) && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
            {/* Privacy Toggle */}
            {onPrivacyToggle && (
              <div className="flex items-center gap-1.5 flex-1">
                <span className="text-xs font-medium text-gray-600">Public:</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrivacyToggle(story.id, story.visibility || 'private');
                  }}
                  disabled={isUpdatingPrivacy}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                    isPublic
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  } ${isUpdatingPrivacy ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={isPublic ? 'Make Private' : 'Make Public'}
                >
                  {isUpdatingPrivacy ? '...' : isPublic ? 'Yes' : 'No'}
                </button>
              </div>
            )}

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(story.id);
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="Delete Story"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
