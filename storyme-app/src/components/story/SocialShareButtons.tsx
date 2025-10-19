/**
 * Social Share Buttons Component
 * Allows users to share public stories on social media
 * Tracks share counts when stories are shared
 */

'use client';

import { useState } from 'react';

interface SocialShareButtonsProps {
  storyId: string;
  storyTitle: string;
  storyUrl: string;
  onShare?: (platform: string) => void;
}

export default function SocialShareButtons({
  storyId,
  storyTitle,
  storyUrl,
  onShare,
}: SocialShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [shareCount, setShareCount] = useState(0);

  const trackShare = async (platform: string) => {
    try {
      // Track share on backend
      await fetch(`/api/stories/public/${storyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share',
          platform,
        }),
      });

      setShareCount(prev => prev + 1);
      onShare?.(platform);
    } catch (error) {
      console.error('Error tracking share:', error);
    }
  };

  const handleTwitterShare = () => {
    const text = `Check out this amazing story: ${storyTitle}`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(storyUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
    trackShare('twitter');
  };

  const handleFacebookShare = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(storyUrl)}`;
    window.open(url, '_blank', 'width=600,height=400');
    trackShare('facebook');
  };

  const handlePinterestShare = () => {
    const description = `${storyTitle} - Created with StoryMe`;
    const url = `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(storyUrl)}&description=${encodeURIComponent(description)}`;
    window.open(url, '_blank', 'width=600,height=400');
    trackShare('pinterest');
  };

  const handleEmailShare = () => {
    const subject = `Check out this story: ${storyTitle}`;
    const body = `I thought you'd enjoy this story:\n\n${storyTitle}\n\n${storyUrl}`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    trackShare('email');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(storyUrl);
      setCopied(true);
      trackShare('copy_link');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="text-sm font-medium text-gray-700">Share:</span>

      {/* Twitter */}
      <button
        onClick={handleTwitterShare}
        className="flex items-center gap-2 px-3 py-2 bg-blue-400 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium"
        title="Share on Twitter"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
        </svg>
        <span className="hidden sm:inline">Twitter</span>
      </button>

      {/* Facebook */}
      <button
        onClick={handleFacebookShare}
        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="Share on Facebook"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
        <span className="hidden sm:inline">Facebook</span>
      </button>

      {/* Pinterest */}
      <button
        onClick={handlePinterestShare}
        className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="Share on Pinterest"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" />
        </svg>
        <span className="hidden sm:inline">Pinterest</span>
      </button>

      {/* Email */}
      <button
        onClick={handleEmailShare}
        className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm font-medium"
        title="Share via Email"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span className="hidden sm:inline">Email</span>
      </button>

      {/* Copy Link */}
      <button
        onClick={handleCopyLink}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
          copied
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
        }`}
        title="Copy Link"
      >
        {copied ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Copied!</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="hidden sm:inline">Copy Link</span>
          </>
        )}
      </button>
    </div>
  );
}
