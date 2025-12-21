/**
 * HamburgerMenu Component
 * Collapsible menu for logged-in users to access marketing pages
 * Contains: Home | Products | Pricing | Founder Stories
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function HamburgerMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [founderDropdownOpen, setFounderDropdownOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
    setFounderDropdownOpen(false);
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  return (
    <div className="relative" ref={menuRef}>
      {/* Hamburger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-700 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          {/* Menu Header */}
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Quick Links</p>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <Link
              href="/"
              className={`flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                isActive('/') ? 'bg-blue-50 text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="text-lg">🏠</span>
              <span>Home</span>
            </Link>

            <Link
              href="/products"
              className={`flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                isActive('/products') ? 'bg-blue-50 text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="text-lg">📚</span>
              <span>Products</span>
            </Link>

            <Link
              href="/pricing"
              className={`flex items-center gap-3 px-4 py-2.5 text-base text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors ${
                isActive('/pricing') ? 'bg-blue-50 text-blue-600 font-semibold' : ''
              }`}
            >
              <span className="text-lg">💳</span>
              <span>Pricing</span>
            </Link>

            {/* Founder Stories Submenu */}
            <div>
              <button
                onClick={() => setFounderDropdownOpen(!founderDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-base text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">✍️</span>
                  <span>Founder Stories</span>
                </div>
                <svg
                  className={`w-4 h-4 transition-transform ${founderDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {founderDropdownOpen && (
                <div className="ml-8 mr-4 mt-1 space-y-1 border-l-2 border-gray-200 pl-4">
                  <Link
                    href="/founder-letter"
                    className={`block py-2 text-base text-gray-600 hover:text-blue-600 transition-colors ${
                      isActive('/founder-letter') ? 'text-blue-600 font-semibold' : ''
                    }`}
                  >
                    A Letter from the Founder
                  </Link>
                  <Link
                    href="/founder-journal"
                    className={`block py-2 text-base text-gray-600 hover:text-blue-600 transition-colors ${
                      isActive('/founder-journal') ? 'text-blue-600 font-semibold' : ''
                    }`}
                  >
                    Founder's Journal
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-4 py-2 border-t border-gray-100 mt-2">
            <p className="text-xs text-gray-500 italic">
              Access marketing & info pages
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
