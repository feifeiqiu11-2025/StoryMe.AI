/**
 * Dashboard Navigation Component
 * Navigation bar for logged-in users with dropdown for Communities
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardNav() {
  const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const communityRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (communityRef.current && !communityRef.current.contains(event.target as Node)) {
        setCommunityDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="hidden md:flex space-x-6">
      <Link
        href="/dashboard"
        className="text-gray-700 hover:text-blue-600 px-3 py-2 text-lg font-medium transition-colors"
      >
        Dashboard
      </Link>
      <Link
        href="/create"
        className="text-gray-700 hover:text-blue-600 px-3 py-2 text-lg font-medium transition-colors"
      >
        Create Story
      </Link>
      <Link
        href="/characters"
        className="text-gray-700 hover:text-blue-600 px-3 py-2 text-lg font-medium transition-colors"
      >
        Characters
      </Link>
      <Link
        href="/projects"
        className="text-gray-700 hover:text-blue-600 px-3 py-2 text-lg font-medium transition-colors"
      >
        My Stories
      </Link>

      {/* Community Dropdown */}
      <div className="relative" ref={communityRef}>
        <button
          onClick={() => setCommunityDropdownOpen(!communityDropdownOpen)}
          className="text-gray-700 hover:text-blue-600 px-3 py-2 text-lg font-medium transition-colors flex items-center gap-1"
        >
          Communities
          <svg
            className={`w-4 h-4 transition-transform ${communityDropdownOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {communityDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
            <Link
              href="/community-stories"
              onClick={() => setCommunityDropdownOpen(false)}
              className="block px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">📚</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Community Stories</div>
                  <div className="text-xs text-gray-500 mt-0.5">Discover amazing stories</div>
                </div>
              </div>
            </Link>
            <Link
              href="/my-artists"
              onClick={() => setCommunityDropdownOpen(false)}
              className="block px-4 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">🎨</span>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Little Artists</div>
                  <div className="text-xs text-gray-500 mt-0.5">Showcase young creators</div>
                </div>
              </div>
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
