/**
 * App Promotion Banner Component
 * Shows context-aware CTAs to convert web viewers to app users
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface AppPromoBannerProps {
  isLoggedIn: boolean;
  variant?: 'sticky' | 'inline';
  className?: string;
}

const KIDS_APP_URL = 'https://apps.apple.com/us/app/kindlewood-kids/id6755075039';
const DISMISS_KEY = 'kindlewood_promo_banner_dismissed';

export default function AppPromoBanner({
  isLoggedIn,
  variant = 'inline',
  className = '',
}: AppPromoBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if user has dismissed the banner this session
    const isDismissed = sessionStorage.getItem(DISMISS_KEY) === 'true';
    setDismissed(isDismissed);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem(DISMISS_KEY, 'true');
  };

  // Don't render on server or if dismissed
  if (!mounted || dismissed) {
    return null;
  }

  const isSticky = variant === 'sticky';

  return (
    <div
      className={`
        ${isSticky
          ? 'fixed bottom-0 left-0 right-0 z-50 shadow-lg'
          : 'rounded-xl'
        }
        bg-white border border-gray-200
        ${className}
      `}
    >
      <div className={`
        relative px-4 py-3
        ${isSticky ? 'max-w-5xl mx-auto' : ''}
      `}>
        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors p-1"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-3 pr-6">
          {/* Content */}
          <div className="flex-1">
            {isLoggedIn ? (
              <p className="text-gray-700 text-sm">
                <span className="font-medium">Love this story?</span> Create your own personalized adventure
              </p>
            ) : (
              <p className="text-gray-700 text-sm">
                <span className="font-medium">Get the app</span> for tap-to-read & audio narration
              </p>
            )}
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-2">
            {isLoggedIn ? (
              <Link
                href="/dashboard"
                className="bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                Create Story
              </Link>
            ) : (
              <>
                <a
                  href={KIDS_APP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-purple-600 text-white px-3 py-1.5 rounded-lg font-medium text-xs hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  Get App
                </a>
                <Link
                  href="/signup"
                  className="text-purple-600 px-3 py-1.5 rounded-lg font-medium text-xs hover:bg-purple-50 transition-colors whitespace-nowrap border border-purple-200"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
