/**
 * Little Artists Gallery Page
 * Public gallery showcasing characters shared by the community
 * Shows "Original Creation vs In the Story" side-by-side
 *
 * Features:
 * - Featured artwork carousel in hero section (admin-curated)
 * - Paginated gallery grid (24 per page)
 * - Lightbox modal for expanded view
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import LandingNav from '@/components/navigation/LandingNav';
import { createClient } from '@/lib/supabase/client';

interface PublicCharacter {
  id: string;
  name: string;
  reference_image_url: string;
  animated_preview_url: string;
  created_at: string;
}

const PAGE_SIZE = 24;

export default function LittleArtistsGalleryPage() {
  // Gallery state
  const [characters, setCharacters] = useState<PublicCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<PublicCharacter | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Featured carousel state
  const [featuredCharacters, setFeaturedCharacters] = useState<PublicCharacter[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [isMounted, setIsMounted] = useState(false);

  const totalFeatured = featuredCharacters.length;

  // --- Data Loading ---

  useEffect(() => {
    setIsMounted(true);
    checkAuthStatus();
    fetchFeatured();
  }, []);

  // Load gallery when page changes
  useEffect(() => {
    loadPublicCharacters(currentPage);
  }, [currentPage]);

  // Close lightbox on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCharacter(null);
    };
    if (selectedCharacter) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedCharacter]);

  const checkAuthStatus = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    } catch {
      setIsLoggedIn(false);
    }
  };

  const loadPublicCharacters = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/public-characters?page=${page}&limit=${PAGE_SIZE}`);
      if (!response.ok) throw new Error('Failed to load characters');

      const data = await response.json();
      setCharacters(data.characters || []);
      setTotalPages(data.totalPages || 1);
      setTotalCount(data.total || 0);

      // Scroll to gallery section on page change (not on initial load)
      if (page > 1) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error('Error loading public characters:', err);
      setError(err instanceof Error ? err.message : 'Failed to load characters');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatured = async () => {
    try {
      const response = await fetch('/api/public-characters?featured=true');
      if (response.ok) {
        const data = await response.json();
        setFeaturedCharacters(data.characters || []);
      }
    } catch (err) {
      console.error('Error fetching featured characters:', err);
    } finally {
      setFeaturedLoading(false);
    }
  };

  // --- Carousel Logic ---

  const goToNext = useCallback(() => {
    if (totalFeatured === 0) return;
    setActiveIndex((prev) => (prev + 1) % totalFeatured);
  }, [totalFeatured]);

  const goToPrev = useCallback(() => {
    if (totalFeatured === 0) return;
    setActiveIndex((prev) => (prev - 1 + totalFeatured) % totalFeatured);
  }, [totalFeatured]);

  // Auto-rotate every 5 seconds
  useEffect(() => {
    if (isPaused || totalFeatured === 0) return;
    const interval = setInterval(goToNext, 5000);
    return () => clearInterval(interval);
  }, [isPaused, totalFeatured, goToNext]);

  // Track viewport width for responsive positioning
  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Card positioning with CSS transforms (adapted from HeroCarousel for landscape cards)
  const getCardStyle = (index: number): React.CSSProperties => {
    const diff = index - activeIndex;
    const normalizedDiff = ((diff + totalFeatured) % totalFeatured);

    let position = normalizedDiff;
    if (normalizedDiff > totalFeatured / 2) {
      position = normalizedDiff - totalFeatured;
    }

    const isMobile = viewportWidth < 640;
    const isTablet = viewportWidth < 1024;
    const maxVisiblePosition = isMobile ? 1 : 2;

    // Hide cards beyond visible range
    if (Math.abs(position) > maxVisiblePosition) {
      return {
        opacity: 0,
        transform: 'scale(0.5) translateX(0)',
        zIndex: 0,
        pointerEvents: 'none' as const,
      };
    }

    let scale: number;
    if (position === 0) {
      scale = isMobile ? 0.95 : 1;
    } else if (Math.abs(position) === 1) {
      scale = isMobile ? 0.7 : 0.82;
    } else {
      scale = 0.7;
    }

    const opacity = position === 0 ? 1 : 0.85 - Math.abs(position) * 0.1;

    // Wider spacing for landscape cards
    let translateXPx: number;
    if (position === 0) {
      translateXPx = 0;
    } else if (Math.abs(position) === 1) {
      if (isMobile) {
        translateXPx = position * 170;
      } else if (isTablet) {
        translateXPx = position * 260;
      } else {
        translateXPx = position * 310;
      }
    } else {
      if (isTablet) {
        translateXPx = position * 220;
      } else {
        translateXPx = position * 260;
      }
    }

    const zIndex = 10 - Math.abs(position);

    return {
      transform: `translateX(${translateXPx}px) scale(${scale})`,
      opacity,
      zIndex,
      transition: 'all 0.5s ease-out',
    };
  };

  // Landscape card dimensions (wider for side-by-side comparison)
  const getCardSize = (isCenter: boolean) => {
    if (viewportWidth < 640) return isCenter ? { width: 320, height: 180 } : { width: 260, height: 150 };
    if (viewportWidth < 1024) return isCenter ? { width: 440, height: 240 } : { width: 360, height: 200 };
    return isCenter ? { width: 540, height: 280 } : { width: 440, height: 240 };
  };

  // --- Pagination Logic ---

  const generatePageNumbers = (current: number, total: number): (number | '...')[] => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    if (total > 1) pages.push(total);
    return pages;
  };

  // --- Render ---

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <LandingNav />

      <div className="max-w-7xl mx-auto px-4 py-8 pb-20">
        {/* Page Header */}
        <div className="mb-10 text-center max-w-5xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Little Artists Gallery
          </h1>
          <p className="text-gray-600 text-lg sm:text-xl leading-relaxed">
            Each artwork starts with a child&apos;s <strong className="text-orange-600">original drawing</strong> or idea.
          </p>
          <p className="text-gray-600 text-lg sm:text-xl leading-relaxed mt-1">
            Kids guide the transformation by describing their character&apos;s <strong className="text-gray-800">personality</strong> and <strong className="text-gray-800">features</strong>.
          </p>
          <p className="text-gray-600 text-lg sm:text-xl leading-relaxed mt-1">
            And <strong className="text-gray-800">AI</strong> transforms their creation into an illustrated character — ready for <strong className="text-gray-800">adventures</strong> in their own stories.
          </p>
        </div>

        {/* Featured Carousel */}
        {!featuredLoading && featuredCharacters.length >= 3 && isMounted && (
          <div className="mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">Featured Artwork</h2>
            <div className="relative" style={{ height: viewportWidth < 640 ? 220 : viewportWidth < 1024 ? 300 : 340 }}>
              {/* Carousel Cards */}
              <div className="absolute inset-0 flex items-center justify-center">
                {featuredCharacters.map((character, index) => {
                  const style = getCardStyle(index);
                  const isCenter = index === activeIndex;
                  const size = getCardSize(isCenter);

                  return (
                    <div
                      key={character.id}
                      className="absolute cursor-pointer"
                      style={{
                        ...style,
                        width: size.width,
                        height: size.height,
                      }}
                      onClick={() => {
                        if (isCenter) {
                          setSelectedCharacter(character);
                        } else {
                          setActiveIndex(index);
                        }
                      }}
                    >
                      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-xl bg-white">
                        {/* Side-by-side comparison */}
                        <div className="grid grid-cols-2 h-full">
                          <div className="relative overflow-hidden">
                            <Image
                              src={character.reference_image_url}
                              alt={`${character.name} - original`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 160px, (max-width: 1024px) 220px, 270px"
                              priority={isCenter}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 z-10">
                              <p className="text-white text-[10px] sm:text-xs font-medium">Original</p>
                            </div>
                          </div>
                          <div className="relative overflow-hidden">
                            <Image
                              src={character.animated_preview_url}
                              alt={`${character.name} - in story`}
                              fill
                              className="object-cover"
                              sizes="(max-width: 640px) 160px, (max-width: 1024px) 220px, 270px"
                              priority={isCenter}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-2 py-1 z-10">
                              <p className="text-white text-[10px] sm:text-xs font-medium">In the Story</p>
                            </div>
                          </div>
                        </div>
                        {/* Character name overlay */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent px-3 py-2">
                          <h3 className="text-white font-bold text-sm sm:text-base line-clamp-1">{character.name}</h3>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Navigation Controls */}
              <div className="absolute bottom-3 right-4 flex items-center gap-2 z-30">
                <button
                  onClick={goToPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white/90 hover:bg-white transition-colors shadow-sm"
                  aria-label="Previous"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={() => setIsPaused(!isPaused)}
                  className="w-9 h-9 flex items-center justify-center rounded-full border-2 border-gray-400 bg-white/90 hover:bg-white transition-colors shadow-sm"
                  aria-label={isPaused ? 'Play' : 'Pause'}
                >
                  {isPaused ? (
                    <svg className="w-4 h-4 text-gray-700 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={goToNext}
                  className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white/90 hover:bg-white transition-colors shadow-sm"
                  aria-label="Next"
                >
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
                <div className="p-4 pb-2">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="aspect-square bg-gray-200 rounded-lg" />
                    </div>
                    <div>
                      <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
                      <div className="aspect-square bg-gray-200 rounded-lg" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <p className="text-red-600 text-lg mb-4">Failed to load gallery</p>
            <button
              onClick={() => loadPublicCharacters(currentPage)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Character Grid */}
        {!loading && !error && characters.length > 0 && (
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 text-center">More Artwork</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((character) => (
              <div
                key={character.id}
                onClick={() => setSelectedCharacter(character)}
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="p-4 pb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {character.name}
                  </h3>
                </div>
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Original Creation</p>
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                        <Image
                          src={character.reference_image_url}
                          alt={`${character.name} - original`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">In the Story</p>
                      <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                        <Image
                          src={character.animated_preview_url}
                          alt={`${character.name} - in story`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 22vw, 18vw"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && characters.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl shadow-md">
            <h3 className="text-xl font-bold text-gray-900 mb-2">No artworks shared yet</h3>
            <p className="text-gray-600">
              Be the first to share your character creations with the community!
            </p>
          </div>
        )}

        {/* Footer - How to share */}
        {!loading && !error && (
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Want to showcase your artwork here?
              </h3>
              <p className="text-gray-600 mb-4">
                Create characters in your Character Library and tap the share icon
                to make them visible in this gallery.
              </p>
              {isLoggedIn ? (
                <Link
                  href="/characters"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Go to Character Library &rarr;
                </Link>
              ) : (
                <Link
                  href="/signup"
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Sign Up Free &rarr;
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Pagination Bar */}
      {!loading && totalPages > 1 && (
        <div className="sticky bottom-0 z-40 bg-white/95 backdrop-blur-sm border-t border-gray-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {totalCount} artwork{totalCount !== 1 ? 's' : ''} &middot; Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              {/* Previous */}
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Prev
              </button>

              {/* Page Numbers */}
              {generatePageNumbers(currentPage, totalPages).map((page, i) =>
                page === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-gray-400 text-sm">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 text-sm font-medium rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {selectedCharacter && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedCharacter(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCharacter.name}
              </h2>
              <button
                onClick={() => setSelectedCharacter(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Original Creation</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                    <Image
                      src={selectedCharacter.reference_image_url}
                      alt={`${selectedCharacter.name} - original creation`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 90vw, 45vw"
                      priority
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">In the Story</p>
                  <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 relative">
                    <Image
                      src={selectedCharacter.animated_preview_url}
                      alt={`${selectedCharacter.name} - in the story`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 90vw, 45vw"
                      priority
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
