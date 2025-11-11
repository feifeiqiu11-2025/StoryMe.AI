/**
 * LandingNav Component
 * Navigation bar for marketing/landing pages (not logged in)
 * Features dropdown menus and mobile hamburger menu
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LandingNav() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const [founderDropdownOpen, setFounderDropdownOpen] = useState(false);
  const [communityDropdownOpen, setCommunityDropdownOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const pathname = usePathname();

  // Check if user is logged in
  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkAuth();
  }, []);

  const productsRef = useRef<HTMLDivElement>(null);
  const founderRef = useRef<HTMLDivElement>(null);
  const communityRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (productsRef.current && !productsRef.current.contains(event.target as Node)) {
        setProductsDropdownOpen(false);
      }
      if (founderRef.current && !founderRef.current.contains(event.target as Node)) {
        setFounderDropdownOpen(false);
      }
      if (communityRef.current && !communityRef.current.contains(event.target as Node)) {
        setCommunityDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition-opacity text-gray-900">
              📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-600">Wood</span> Studio ✨
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-6">
            <Link
              href="/"
              className={`text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/') ? 'text-blue-600 border-b-2 border-blue-600' : ''
              }`}
            >
              Home
            </Link>

            {/* Products Dropdown */}
            <div className="relative" ref={productsRef}>
              <button
                onClick={() => setProductsDropdownOpen(!productsDropdownOpen)}
                className={`text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isActive('/products') ? 'text-blue-600 border-b-2 border-blue-600' : ''
                }`}
              >
                Products
                <svg
                  className={`w-4 h-4 transition-transform ${productsDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {productsDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                  <Link
                    href="/products"
                    onClick={() => setProductsDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">KindleWood Ecosystem</div>
                    <div className="text-xs text-gray-500 mt-0.5">Studio & Kids - Full overview</div>
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className={`text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors ${
                isActive('/pricing') ? 'text-blue-600 border-b-2 border-blue-600' : ''
              }`}
            >
              Pricing
            </Link>

            {/* Founder Stories Dropdown */}
            <div className="relative" ref={founderRef}>
              <button
                onClick={() => setFounderDropdownOpen(!founderDropdownOpen)}
                className={`text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isActive('/founder-letter') || isActive('/founder-journal') ? 'text-blue-600 border-b-2 border-blue-600' : ''
                }`}
              >
                Founder Stories
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
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                  <Link
                    href="/founder-letter"
                    onClick={() => setFounderDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">A Letter from the Founder</div>
                  </Link>
                  <Link
                    href="/founder-journal"
                    onClick={() => setFounderDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">Founder's Journal</div>
                  </Link>
                </div>
              )}
            </div>

            {/* Community Dropdown */}
            <div className="relative" ref={communityRef}>
              <button
                onClick={() => setCommunityDropdownOpen(!communityDropdownOpen)}
                className={`text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors flex items-center gap-1 ${
                  isActive('/stories') || isActive('/little-artists') || isActive('/community-stories') ? 'text-blue-600 border-b-2 border-blue-600' : ''
                }`}
              >
                Community
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
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                  <Link
                    href="/stories"
                    onClick={() => setCommunityDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">📚 Community Stories</div>
                    <div className="text-xs text-gray-500 mt-0.5">Discover amazing stories</div>
                  </Link>
                  <Link
                    href="/little-artists"
                    onClick={() => setCommunityDropdownOpen(false)}
                    className="block px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
                  >
                    <div className="font-semibold text-gray-900">🎨 Little Artists</div>
                    <div className="text-xs text-gray-500 mt-0.5">Meet our young creators</div>
                  </Link>
                </div>
              )}
            </div>
          </nav>

          {/* Auth Buttons - Desktop */}
          <div className="hidden lg:flex items-center gap-4">
            {!isMounted ? (
              // Placeholder to prevent layout shift
              <div className="px-6 py-2 opacity-0">Sign In</div>
            ) : isLoggedIn ? (
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition-all text-sm"
              >
                Dashboard
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-gray-700 hover:text-gray-900 font-medium px-6 py-2 rounded-lg hover:bg-gray-100 transition-all"
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-700 hover:text-blue-600 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 py-4 space-y-2">
            <Link
              href="/"
              className={`block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors ${
                isActive('/') ? 'bg-blue-50 text-blue-600 font-semibold' : ''
              }`}
            >
              Home
            </Link>

            {/* Products - Mobile */}
            <div>
              <button
                onClick={() => setProductsDropdownOpen(!productsDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
              >
                <span>Products</span>
                <svg
                  className={`w-4 h-4 transition-transform ${productsDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {productsDropdownOpen && (
                <div className="ml-4 mt-2 space-y-1">
                  <Link
                    href="/products"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer active:bg-blue-100"
                    style={{ WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    KindleWood Ecosystem
                  </Link>
                </div>
              )}
            </div>

            <Link
              href="/pricing"
              className={`block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors ${
                isActive('/pricing') ? 'bg-blue-50 text-blue-600 font-semibold' : ''
              }`}
            >
              Pricing
            </Link>

            {/* Founder Stories - Mobile */}
            <div>
              <button
                onClick={() => setFounderDropdownOpen(!founderDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
              >
                <span>Founder Stories</span>
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
                <div className="ml-4 mt-2 space-y-1">
                  <Link
                    href="/founder-letter"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer active:bg-blue-100"
                    style={{ WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    A Letter from the Founder
                  </Link>
                  <Link
                    href="/founder-journal"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer active:bg-blue-100"
                    style={{ WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    Founder's Journal
                  </Link>
                </div>
              )}
            </div>

            {/* Community - Mobile */}
            <div>
              <button
                onClick={() => setCommunityDropdownOpen(!communityDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
              >
                <span>Community</span>
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
                <div className="ml-4 mt-2 space-y-1">
                  <Link
                    href="/stories"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer active:bg-blue-100"
                    style={{ WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    📚 Community Stories
                  </Link>
                  <Link
                    href="/little-artists"
                    className="block px-4 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors cursor-pointer active:bg-blue-100"
                    style={{ WebkitTapHighlightColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    🎨 Little Artists
                  </Link>
                </div>
              )}
            </div>

            {/* Auth Button - Mobile */}
            {isMounted && (
              isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="block px-4 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors font-medium"
                >
                  Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="block mx-4 mt-4 text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold transition-all shadow-md"
                >
                  Sign In
                </Link>
              )
            )}
          </div>
        )}
      </div>
    </header>
  );
}
