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
  // Picture book is the default; chapter_book gets a small badge so users
  // know what they're clicking into. Optional so legacy callers keep working.
  projectType?: 'picture_book' | 'chapter_book';
  title: string;
  description?: string;
  coverImageUrl?: string;
  authorName?: string;
  authorAge?: number;
  viewCount?: number;
  featured?: boolean;
  visibility?: 'public' | 'private' | 'unlisted';
  shareToken?: string | null;
  status?: 'draft' | 'processing' | 'completed' | 'error';
  sceneCount?: number;
  createdAt?: string;
  updatedAt?: string;
  tags?: StoryTag[];
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
  onPrivacyToggle?: (storyId: string, currentVisibility: 'public' | 'private' | 'unlisted') => void;
  onShareLink?: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
  isUpdatingPrivacy?: boolean;
  adminActions?: React.ReactNode;
  tagEditor?: React.ReactNode;
  onRemoveTag?: (storyId: string, tagId: string) => void;
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
  onShareLink,
  onDelete,
  isUpdatingPrivacy = false,
  adminActions,
  tagEditor,
  onRemoveTag,
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

  const isDraft = story.status === 'draft';
  const isPublic = story.visibility === 'public';
  const isUnlisted = story.visibility === 'unlisted';
  const isChapterBook = story.projectType === 'chapter_book';
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
      // flex column lets the action footer (myStories variant) pin to
      // the bottom via mt-auto. CSS Grid stretches each card to its
      // row's tallest sibling automatically, so we don't need h-full
      // here (h-full was over-stretching the lone chapter-book card
      // inside its horizontal-scroll row, leaving a tall white gap
      // between cover and title).
      className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer flex flex-col"
    >
      {/* Cover Image — square frame, regardless of source aspect ratio.
          overflow-hidden on the wrapper itself defends against portrait/
          landscape source images stretching the wrapper past aspect-square
          (which can happen in flex contexts where aspect-ratio yields to
          larger content). The chapter-book cover is portrait 1020×1479
          due to the html2canvas snapshot pipeline; without overflow
          clipping here, those covers blow the card out vertically. */}
      <div className="relative aspect-square bg-gradient-to-br from-blue-100 to-purple-100 overflow-hidden">
        {coverImage ? (
          <img
            src={coverImage}
            alt={story.title}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-6xl">📖</span>
          </div>
        )}

        {/* Privacy + chapter-book badges — icon-only round pills so the
            cover art stays visible. Title attribute provides the label
            on hover; aria-label keeps screen readers informed. */}
        {showPrivacyBadge && (
          <div className="absolute top-2 left-2 flex flex-col gap-1.5">
            {isDraft ? (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full bg-amber-500 text-white text-base shadow-md ring-2 ring-white/40"
                title="Draft"
                aria-label="Draft"
              >
                ✏️
              </span>
            ) : isPublic ? (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full bg-green-500 text-white text-base shadow-md ring-2 ring-white/40"
                title="Public"
                aria-label="Public"
              >
                🌍
              </span>
            ) : isUnlisted ? (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full bg-blue-500 text-white text-base shadow-md ring-2 ring-white/40"
                title="Link only"
                aria-label="Link only"
              >
                🔗
              </span>
            ) : (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-600 text-white text-base shadow-md ring-2 ring-white/40"
                title="Private"
                aria-label="Private"
              >
                🔒
              </span>
            )}
            {isChapterBook && (
              <span
                className="w-7 h-7 flex items-center justify-center rounded-full bg-purple-600 text-white text-base shadow-md ring-2 ring-white/40"
                title="Chapter Book"
                aria-label="Chapter Book"
              >
                📖
              </span>
            )}
          </div>
        )}

        {/* The standalone chapter-book badge (shown on community cards
            when there's no privacy badge stack) was removed because
            chapter books now live in their own labeled "Chapter Stories"
            row on community pages. The badge stays in myStories where
            it stacks under the privacy pill — still useful there as
            management context. */}

        {/* Top Right - Featured Star (icon only — no label so cover art stays visible) */}
        {showFeaturedBadge && story.featured && (
          <div
            aria-label="Featured"
            title="Featured"
            className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center"
          >
            <svg
              className="w-7 h-7 text-yellow-400 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="white"
              strokeWidth={1.25}
              strokeLinejoin="round"
            >
              <path d="M12 2.5l2.95 5.97 6.59.96-4.77 4.65 1.13 6.57L12 17.55l-5.9 3.1 1.13-6.57L2.46 9.43l6.59-.96L12 2.5z" />
            </svg>
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

      {/* Story Info — community variant is compact (cover-dominant browse
          card; description + tags belong on the detail page, not the
          tile). MyStories variant stays richer because the owner needs
          tags + action buttons inline. */}
      <div
        // Community: fixed-height compact box (no action row, so a
        // fixed clamp keeps the grid tidy).
        // MyStories: flex-1 lets the info box claim all remaining
        // vertical space inside the card, so the action footer below
        // can be pinned to the bottom via mt-auto.
        className={`flex flex-col ${
          variant === 'community' ? 'px-3 py-2.5 h-[72px]' : 'p-4 flex-1'
        }`}
      >
        {/* Title — Comic Neue (rounded, kid-friendly script) at bold
            weight on community variant. It's the same font kids can
            pick from the chapter-book editor's "Comic" style, and it
            reads warmer than Geist sans for a children's-content feed.
            MyStories keeps bold Geist because the owner is scanning
            their own library more like a list than a storefront. */}
        <h3
          className={`text-gray-900 leading-tight ${
            variant === 'community'
              ? 'text-base font-bold line-clamp-1'
              : 'text-lg font-bold mb-1 line-clamp-2'
          }`}
          style={
            variant === 'community'
              ? { fontFamily: "'Comic Neue', 'Comic Sans MS', cursive" }
              : undefined
          }
        >
          {story.title}
        </h3>

        {/* Meta Info — date only on My Stories. Scene count was removed
            because (a) it didn't apply to chapter books (which have
            pages, not scenes) and (b) the count was occasionally stale
            relative to the actual project state. Date is enough context. */}
        {showDate && formattedDate && (
          <div className="text-xs text-gray-500 mb-2">{formattedDate}</div>
        )}

        {/* Tags row — myStories only. The community variant drops tags
            entirely; they were eating space for information that the
            kid almost never read on a browse card. Tags still appear
            on the detail page. */}
        {variant === 'myStories' &&
          ((story.tags && story.tags.length > 0) || tagEditor) && (
            <div className="flex flex-wrap items-center gap-1 mb-2">
              {(onRemoveTag ? story.tags : story.tags?.slice(0, 3))?.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"
                >
                  {tag.name}
                  {onRemoveTag && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(story.id, tag.id);
                      }}
                      className="ml-1 text-gray-400 hover:text-red-500"
                    >
                      &times;
                    </button>
                  )}
                </span>
              ))}
              {!onRemoveTag && story.tags && story.tags.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs">
                  +{story.tags.length - 3}
                </span>
              )}
              {tagEditor}
            </div>
          )}

        {/* Description removed across both variants — browse cards
            shouldn't carry paragraph copy. The full description lives
            on the detail page where the kid clicks to read more. */}

        {/* Author Info (Community Stories) — Comic Neue too so the
            byline matches the title's family. Regular weight keeps it
            subtle below the bolder title. */}
        {showAuthor && story.authorName && (
          <p
            className="text-xs text-gray-500 truncate mt-0.5"
            style={
              variant === 'community'
                ? { fontFamily: "'Comic Neue', 'Comic Sans MS', cursive" }
                : undefined
            }
          >
            by {story.authorName}
            {story.authorAge && `, age ${story.authorAge}`}
          </p>
        )}

        {/* Action Buttons (My Stories only) — mt-auto pins the footer
            to the bottom of the info box, so it sits at a consistent
            vertical position across cards even when title/date/tags
            above it have different heights. */}
        {variant === 'myStories' && (onPrivacyToggle || onShareLink || onDelete || adminActions) && (
          <div className="flex items-center gap-2 mt-auto pt-3 border-t border-gray-100">
            {isDraft ? (
              /* Draft: Show "Continue Editing" label instead of privacy toggle */
              <span className="flex-1 text-xs font-medium text-amber-600">
                Continue editing →
              </span>
            ) : (
              /* Completed: Show privacy toggle */
              onPrivacyToggle && (
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
              )
            )}

            {/* Share-link icon: opens popover to enable/disable/copy unlisted link.
                Hidden for drafts (no story to share yet) and for public stories
                (anyone can already get the URL from the community share button). */}
            {!isDraft && onShareLink && !isPublic && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShareLink(story.id);
                }}
                className={`p-2 rounded-lg transition-all ${
                  isUnlisted
                    ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                    : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
                title={isUnlisted ? 'Share link active — manage' : 'Share by link'}
                aria-label={isUnlisted ? 'Manage share link' : 'Share by link'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </button>
            )}

            {/* Admin Actions (star, tag) - rendered inline next to delete */}
            {adminActions}

            {/* Delete Button */}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(story.id);
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title={isDraft ? 'Delete Draft' : 'Delete Story'}
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
