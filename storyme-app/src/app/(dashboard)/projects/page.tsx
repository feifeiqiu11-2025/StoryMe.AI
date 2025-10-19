/**
 * Projects/Stories Page
 * Browse and manage all user's stories
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import type { StoryVisibility } from '@/lib/types/story';

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<any[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [privacyConfirm, setPrivacyConfirm] = useState<{ id: string; newVisibility: StoryVisibility } | null>(null);
  const [updatingPrivacy, setUpdatingPrivacy] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState<string | null>(null);

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

          // Fetch user's projects
          await fetchProjects();
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
            await fetchProjects();
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

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();

      if (response.ok) {
        setProjects(data.projects || []);
      } else {
        console.error('Failed to fetch projects:', data.error);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handlePrivacyToggle = (projectId: string, currentVisibility: StoryVisibility) => {
    const newVisibility: StoryVisibility = currentVisibility === 'public' ? 'private' : 'public';

    // If going public, show confirmation
    if (newVisibility === 'public') {
      setPrivacyConfirm({ id: projectId, newVisibility });
    } else {
      // Going private, no confirmation needed
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
        // Update local state
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

  const handleShare = (projectId: string) => {
    setShareModalOpen(projectId);
  };

  const copyShareLink = (projectId: string) => {
    const url = `${window.location.origin}/stories/${projectId}`;
    navigator.clipboard.writeText(url);
    alert('Link copied to clipboard!');
  };

  const handleDeleteProject = async (projectId: string) => {
    console.log('[handleDeleteProject] Starting delete for project:', projectId);
    setDeleting(true);
    try {
      const url = `/api/projects/${projectId}`;
      console.log('[handleDeleteProject] DELETE URL:', url);

      const response = await fetch(url, {
        method: 'DELETE',
      });

      console.log('[handleDeleteProject] Response status:', response.status);
      console.log('[handleDeleteProject] Response ok:', response.ok);

      if (response.ok) {
        console.log('[handleDeleteProject] Delete successful, removing from list');
        // Remove from list
        setProjects(projects.filter(p => p.id !== projectId));
        setDeleteConfirm(null);
      } else {
        let errorMessage = 'Unknown error';
        try {
          const data = await response.json();
          console.error('[handleDeleteProject] Server error data:', data);
          errorMessage = data.error || JSON.stringify(data) || 'No error message';
        } catch (jsonError) {
          console.error('[handleDeleteProject] Failed to parse error JSON:', jsonError);
          const text = await response.text();
          console.error('[handleDeleteProject] Raw error response:', text);
          errorMessage = text || `HTTP ${response.status}`;
        }
        alert(`Failed to delete: ${errorMessage}`);
      }
    } catch (error) {
      console.error('[handleDeleteProject] Fetch error:', error);
      alert(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('[handleDeleteProject] Finished delete attempt');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Stories</h1>
          <p className="text-gray-600">
            Browse and manage all your personalized storybooks
          </p>
        </div>

        {/* Projects Grid */}
        {loadingProjects ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading your stories...</p>
          </div>
        ) : projects.length === 0 ? (
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const firstImage = project.scenes?.[0]?.images?.[0]?.imageUrl;
              const sceneCount = project.scenes?.length || 0;
              const createdDate = new Date(project.createdAt).toLocaleDateString();

              const isPublic = project.visibility === 'public';
              const isFeatured = project.featured;
              const viewCount = project.viewCount || 0;

              return (
                <div
                  key={project.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 cursor-pointer"
                  onClick={() => router.push(`/projects/${project.id}`)}
                >
                  {/* Cover Image with Privacy Badges */}
                  {firstImage ? (
                    <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100">
                      <img
                        src={firstImage}
                        alt={project.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Privacy Badge (Top Left) */}
                      <div className="absolute top-2 left-2">
                        {isPublic ? (
                          <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-md">
                            <span>🌍</span>
                            <span>Public</span>
                            {viewCount > 0 && (
                              <>
                                <span className="mx-1">•</span>
                                <span>👁️ {viewCount}</span>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-md">
                            <span>🔒</span>
                            <span>Private</span>
                          </div>
                        )}
                      </div>
                      {/* Featured Badge (Top Right) */}
                      {isFeatured && (
                        <div className="absolute top-2 right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-md">
                          <span>⭐ Featured</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                      <div className="text-6xl">📖</div>
                      {/* Privacy Badge (Top Left) */}
                      <div className="absolute top-2 left-2">
                        {isPublic ? (
                          <div className="flex items-center gap-1 bg-green-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-md">
                            <span>🌍</span>
                            <span>Public</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-gray-600 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-md">
                            <span>🔒</span>
                            <span>Private</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Title and Meta */}
                    <div className="mb-3">
                      <h3 className="text-xl font-bold text-gray-900 mb-1 line-clamp-1">
                        {project.title}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{sceneCount} scenes</span>
                        <span>•</span>
                        <span>{createdDate}</span>
                      </div>
                    </div>

                    {project.description && (
                      <p className="text-gray-600 text-sm mb-4 line-clamp-1">
                        {project.description}
                      </p>
                    )}

                    {/* Action Buttons - Single Row */}
                    <div className="flex items-center gap-2">
                      {/* Public Toggle */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-gray-600">Public:</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrivacyToggle(project.id, project.visibility || 'private');
                          }}
                          disabled={updatingPrivacy === project.id}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                            isPublic
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                          } ${updatingPrivacy === project.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title={isPublic ? 'Make Private' : 'Make Public'}
                        >
                          {updatingPrivacy === project.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                          ) : (
                            <span>{isPublic ? 'Yes' : 'No'}</span>
                          )}
                        </button>
                      </div>

                      {/* Share Button (only if public) */}
                      {isPublic && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleShare(project.id);
                          }}
                          className="p-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-all"
                          title="Share this story"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                      )}

                      {/* Spacer */}
                      <div className="flex-1"></div>

                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(project.id);
                        }}
                        className="p-2 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-all"
                        title="Delete this story"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
                  ⚠️ Important: Make sure your story doesn't contain personal information like addresses, phone numbers, or school names.
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
