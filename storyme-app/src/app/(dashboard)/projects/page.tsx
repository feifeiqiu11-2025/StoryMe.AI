/**
 * Projects/Stories Page
 * Browse and manage all user's stories with pagination
 *
 * Performance optimizations:
 * - Page cache: Stores fetched pages in memory for instant back/forward navigation
 * - Prefetch: Loads next page in background for perceived instant navigation
 * - Progress indicator: Shows loading state in pagination bar
 */

'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { StoryVisibility } from '@/lib/types/story';
import { StoryCard, type StoryCardData } from '@/components/story/StoryCard';

const PAGE_SIZE = 12; // 12 divides evenly by 1, 2, 3, 4 columns

// Type for cached page data
interface CachedPage {
  projects: any[];
  total: number;
  timestamp: number;
}

// Cache expiry time (5 minutes) - user's own data changes infrequently
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Pagination Component
 * Responsive: simplified on mobile, full numbers on desktop
 * Shows loading indicator during page transitions
 */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
  isLoading,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled: boolean;
  isLoading?: boolean;
}) {
  if (totalPages <= 1) return null;

  // Generate page numbers to show
  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    const showEllipsis = totalPages > 7;

    if (!showEllipsis) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="mt-8 flex justify-center">
      <nav className="flex items-center gap-1" aria-label="Pagination">
        {/* Loading indicator */}
        {isLoading && (
          <div className="mr-2 flex items-center gap-1.5 text-sm text-gray-500">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="hidden sm:inline">Loading...</span>
          </div>
        )}
        {/* Previous Button */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={disabled || currentPage === 1}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Previous page"
        >
          <span className="hidden sm:inline">Previous</span>
          <span className="sm:hidden">&larr;</span>
        </button>

        {/* Mobile: Simple page indicator */}
        <div className="flex sm:hidden items-center px-3 py-2 text-sm font-medium text-gray-700">
          Page {currentPage} of {totalPages}
        </div>

        {/* Desktop: Page numbers */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, index) =>
            page === 'ellipsis' ? (
              <span
                key={`ellipsis-${index}`}
                className="px-3 py-2 text-gray-400"
              >
                ...
              </span>
            ) : (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                disabled={disabled}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-all ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        {/* Next Button */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={disabled || currentPage === totalPages}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <span className="sm:hidden">&rarr;</span>
        </button>
      </nav>
    </div>
  );
}

/**
 * Skeleton loader for story cards
 */
function StoryCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-4 space-y-3">
        <div className="h-5 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-full" />
      </div>
    </div>
  );
}

/**
 * Main content component that uses searchParams
 */
function ProjectsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current page from URL (1-indexed)
  const pageFromUrl = parseInt(searchParams.get('page') || '1', 10);
  const currentPage = isNaN(pageFromUrl) || pageFromUrl < 1 ? 1 : pageFromUrl;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [total, setTotal] = useState(0);
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Track if first fetch completed
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [privacyConfirm, setPrivacyConfirm] = useState<{ id: string; newVisibility: StoryVisibility } | null>(null);
  const [updatingPrivacy, setUpdatingPrivacy] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null);

  // AbortController ref for canceling stale requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Page cache for instant navigation
  const pageCacheRef = useRef<Map<number, CachedPage>>(new Map());

  // Ref to track if prefetch is in progress (to avoid duplicate prefetches)
  const prefetchingRef = useRef<Set<number>>(new Set());

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Validate and clamp current page
  const validPage = Math.min(Math.max(1, currentPage), totalPages || 1);

  /**
   * Fetch a page of projects from API
   * @param page - Page number to fetch
   * @param useCache - Whether to check cache first (default: true)
   * @param isPrefetch - Whether this is a background prefetch (default: false)
   */
  const fetchProjects = useCallback(async (
    page: number,
    useCache: boolean = true,
    isPrefetch: boolean = false
  ) => {
    const cache = pageCacheRef.current;

    // Check cache first (unless explicitly bypassed)
    if (useCache) {
      const cached = cache.get(page);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        // Cache hit! Use cached data instantly
        if (!isPrefetch) {
          setProjects(cached.projects);
          setTotal(cached.total);
          setInitialLoadDone(true);
        }
        return;
      }
    }

    // For prefetch, check if already in progress
    if (isPrefetch) {
      if (prefetchingRef.current.has(page)) {
        return; // Already prefetching this page
      }
      prefetchingRef.current.add(page);
    } else {
      // Cancel any in-flight request for main fetches
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      setLoadingProjects(true);
    }

    try {
      const offset = (page - 1) * PAGE_SIZE;
      const response = await fetch(
        `/api/projects?limit=${PAGE_SIZE}&offset=${offset}`,
        { signal: isPrefetch ? undefined : abortControllerRef.current?.signal }
      );
      const data = await response.json();

      if (response.ok) {
        const pageData: CachedPage = {
          projects: data.projects || [],
          total: data.total || 0,
          timestamp: Date.now(),
        };

        // Store in cache
        cache.set(page, pageData);

        // Update state only for non-prefetch requests
        if (!isPrefetch) {
          setProjects(pageData.projects);
          setTotal(pageData.total);
          setInitialLoadDone(true); // Mark initial load complete

          // If page is beyond valid range, redirect to last valid page
          const newTotalPages = Math.ceil((data.total || 0) / PAGE_SIZE);
          if (page > newTotalPages && newTotalPages > 0) {
            router.replace(`/projects?page=${newTotalPages}`, { scroll: false });
          }
        }
      } else if (!isPrefetch) {
        console.error('Failed to fetch projects:', data.error);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was cancelled, ignore
        return;
      }
      if (!isPrefetch) {
        console.error('Error fetching projects:', error);
      }
    } finally {
      if (isPrefetch) {
        prefetchingRef.current.delete(page);
      } else {
        setLoadingProjects(false);
      }
    }
  }, [router]);

  /**
   * Prefetch adjacent pages in background
   */
  const prefetchAdjacentPages = useCallback((currentPage: number, totalPages: number) => {
    // Prefetch next page if it exists
    if (currentPage < totalPages) {
      fetchProjects(currentPage + 1, true, true);
    }
    // Optionally prefetch previous page too (less common navigation)
    if (currentPage > 1) {
      fetchProjects(currentPage - 1, true, true);
    }
  }, [fetchProjects]);

  /**
   * Invalidate cache for a specific page or all pages
   */
  const invalidateCache = useCallback((page?: number) => {
    if (page !== undefined) {
      pageCacheRef.current.delete(page);
    } else {
      pageCacheRef.current.clear();
    }
  }, []);

  // Load user on mount
  useEffect(() => {
    const loadUser = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          const userData = {
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          };
          setUser(userData);
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
          } else {
            localStorage.removeItem('storyme_session');
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [router]);

  // Fetch projects when user is loaded or page changes
  useEffect(() => {
    if (user) {
      fetchProjects(validPage);
    }
  }, [user, validPage, fetchProjects]);

  // Prefetch adjacent pages after current page loads
  useEffect(() => {
    if (user && !loadingProjects && totalPages > 1) {
      // Small delay to prioritize current page render
      const timer = setTimeout(() => {
        prefetchAdjacentPages(validPage, totalPages);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, validPage, totalPages, loadingProjects, prefetchAdjacentPages]);

  // Handle page change - update URL
  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || loadingProjects) return;

    // Update URL with new page
    router.push(`/projects?page=${newPage}`, { scroll: false });

    // Scroll to top of grid
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrivacyToggle = (projectId: string, currentVisibility: StoryVisibility) => {
    const newVisibility: StoryVisibility = currentVisibility === 'public' ? 'private' : 'public';

    if (newVisibility === 'public') {
      setPrivacyConfirm({ id: projectId, newVisibility });
    } else {
      updateProjectPrivacy(projectId, newVisibility);
    }
  };

  const updateProjectPrivacy = async (projectId: string, newVisibility: StoryVisibility) => {
    setUpdatingPrivacy(projectId);
    setPrivacyConfirm(null);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (response.ok) {
        // Invalidate current page cache (visibility changed)
        invalidateCache(validPage);

        setProjects(projects.map(p =>
          p.id === projectId
            ? { ...p, visibility: newVisibility }
            : p
        ));
      } else {
        const data = await response.json();
        alert(`Failed to update privacy: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating privacy:', error);
      alert('Failed to update privacy. Please try again.');
    } finally {
      setUpdatingPrivacy(null);
    }
  };

  const copyShareLink = (projectId: string) => {
    const url = `${window.location.origin}/stories/${projectId}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleDeleteProject = async (projectId: string) => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Invalidate all cached pages (delete affects pagination)
        invalidateCache();

        // Remove from local state and decrement total
        setProjects(prev => prev.filter(p => p.id !== projectId));
        setTotal(prev => prev - 1);
        setDeleteConfirm(null);

        // If this was the last item on the page and we're not on page 1, go to previous page
        const newTotal = total - 1;
        const newTotalPages = Math.ceil(newTotal / PAGE_SIZE);
        if (projects.length === 1 && validPage > 1 && validPage > newTotalPages) {
          router.replace(`/projects?page=${newTotalPages}`, { scroll: false });
        }
      } else {
        let errorMessage = 'Unknown error';
        try {
          const data = await response.json();
          errorMessage = data.error || JSON.stringify(data) || 'No error message';
        } catch {
          const text = await response.text();
          errorMessage = text || `HTTP ${response.status}`;
        }
        alert(`Failed to delete: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Calculate display range
  const startItem = total === 0 ? 0 : (validPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(validPage * PAGE_SIZE, total);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stories</h1>
        <p className="text-gray-600">
          Browse and manage all your personalized storybooks
        </p>
      </div>

      {/* Projects Grid */}
      {loadingProjects || !initialLoadDone ? (
        // Skeleton loader grid - show during loading OR before first fetch completes
        <div>
          <div className="h-5 bg-gray-200 rounded w-40 mb-4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: Math.min(6, PAGE_SIZE) }).map((_, i) => (
              <StoryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ) : projects.length === 0 && total === 0 ? (
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
          <div className="text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            No Stories Yet
          </h2>
          <p className="text-gray-600 mb-6">
            Start creating your first personalized storybook!
          </p>
          <Link
            href="/create"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            Create Your First Story
          </Link>
        </div>
      ) : (
        <>
          {/* Story count */}
          {total > 0 && (
            <p className="text-sm text-gray-500 mb-4">
              Showing {startItem}–{endItem} of {total} stories
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {projects.map((project) => {
              const storyData: StoryCardData = {
                id: project.id,
                title: project.title,
                description: project.description,
                coverImageUrl: project.coverImageUrl,
                visibility: project.visibility,
                viewCount: project.viewCount,
                featured: project.featured,
                sceneCount: project.scenes?.length || 0,
                createdAt: project.createdAt,
                scenes: project.scenes,
              };

              return (
                <StoryCard
                  key={project.id}
                  story={storyData}
                  onClick={() => router.push(`/projects/${project.id}`)}
                  variant="myStories"
                  onPrivacyToggle={handlePrivacyToggle}
                  onDelete={() => setDeleteConfirm(project.id)}
                  isUpdatingPrivacy={updatingPrivacy === project.id}
                />
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={validPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            disabled={loadingProjects}
            isLoading={loadingProjects}
          />
        </>
      )}

      {/* Privacy Confirmation Modal */}
      {privacyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Story Public?</h3>
            <p className="text-gray-600 mb-4">
              Your story will be visible to everyone on the landing page and public gallery.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 font-medium">
                Warning: Make sure your story does not contain personal information like addresses, phone numbers, or school names.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateProjectPrivacy(privacyConfirm.id, privacyConfirm.newVisibility)}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-semibold transition-all"
              >
                Make Public
              </button>
              <button
                onClick={() => setPrivacyConfirm(null)}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Share Your Story</h3>
            <p className="text-gray-600 mb-6">
              Share this story with friends and family!
            </p>

            {/* Share URL */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Story Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/stories/${shareModalOpen}`}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={() => copyShareLink(shareModalOpen)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-all"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Social Share Buttons */}
            <div className="space-y-3 mb-6">
              <button
                onClick={() => {
                  const url = `${window.location.origin}/stories/${shareModalOpen}`;
                  const project = projects.find(p => p.id === shareModalOpen);
                  const text = `Check out this amazing story: ${project?.title || 'Story'}`;
                  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-400 hover:bg-blue-500 text-white rounded-lg font-medium transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
                Share on Twitter
              </button>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/stories/${shareModalOpen}`;
                  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'width=600,height=400');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                </svg>
                Share on Facebook
              </button>
            </div>

            <button
              onClick={() => setShareModalOpen(null)}
              className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Delete Story?</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this story? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDeleteProject(deleteConfirm)}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-6 py-3 rounded-xl hover:bg-red-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Page wrapper with Suspense for useSearchParams
 */
export default function ProjectsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ProjectsContent />
    </Suspense>
  );
}
