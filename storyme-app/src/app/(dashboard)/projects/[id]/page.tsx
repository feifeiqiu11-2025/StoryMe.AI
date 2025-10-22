/**
 * Story Viewer Page
 * View individual story with all scenes
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import ReadingModeViewer, { ReadingPage } from '@/components/story/ReadingModeViewer';
import Tooltip from '@/components/ui/Tooltip';

export default function StoryViewerPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [readingPages, setReadingPages] = useState<ReadingPage[]>([]);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [showPublicConfirm, setShowPublicConfirm] = useState(false);
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [publishingToSpotify, setPublishingToSpotify] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          });

          // Fetch project
          await fetchProject();
        } else {
          router.push('/login');
        }
      } else {
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
            await fetchProject();
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

    loadData();
  }, [router, projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (response.ok) {
        setProject(data.project);
        // Check if audio exists
        await checkAudioExists();
        // Check Spotify status
        await checkSpotifyStatus();
      } else {
        console.error('Failed to fetch project:', data.error);
        router.push('/projects');
      }
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/projects');
    }
  };

  const checkAudioExists = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/audio-pages`);
      const data = await response.json();
      setHasAudio(data.hasAudio || false);
    } catch (error) {
      console.error('Error checking audio:', error);
      setHasAudio(false);
    }
  };

  const checkSpotifyStatus = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/spotify-status`);
      const data = await response.json();
      if (data.hasPublication) {
        setSpotifyStatus(data.status);
      }
    } catch (error) {
      console.error('Error checking Spotify status:', error);
    }
  };

  const handleGenerateAudio = async () => {
    if (!project) {
      alert('Project not loaded');
      return;
    }

    setGeneratingAudio(true);

    try {
      console.log('🎵 Starting audio generation...');

      const response = await fetch('/api/generate-story-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Audio generated successfully!\n\n${data.successfulPages} of ${data.totalPages} pages have audio narration.`);
        setHasAudio(true);
        await checkAudioExists();
      } else {
        console.error('Audio generation failed:', data);
        alert(`❌ Audio generation failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Audio generation error:', error);
      alert(`❌ Error generating audio: ${error.message || 'Unknown error'}`);
    } finally {
      setGeneratingAudio(false);
    }
  };

  const handleEnterReadingMode = async () => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes available for reading mode');
      return;
    }

    setLoadingAudio(true);

    try {
      // Fetch audio pages
      const audioResponse = await fetch(`/api/projects/${projectId}/audio-pages`);
      const audioData = await audioResponse.json();

      // Build pages array
      const pages: ReadingPage[] = [];

      // Page 1: Cover page
      const coverText = project.authorName && project.authorAge
        ? `${project.title}, by ${project.authorName}, age ${project.authorAge}`
        : project.authorName
        ? `${project.title}, by ${project.authorName}`
        : project.title;

      const coverAudioPage = audioData.audioPages?.find((ap: any) => ap.page_type === 'cover');

      pages.push({
        pageNumber: 1,
        pageType: 'cover',
        imageUrl: project.coverImageUrl || '/api/placeholder/1024/1024',
        textContent: coverText,
        audioUrl: coverAudioPage?.audio_url,
        audioDuration: coverAudioPage?.audio_duration_seconds,
      });

      // Pages 2+: Scene pages
      const scenes = (project.scenes || [])
        .filter((scene: any) => scene.images && scene.images.length > 0)
        .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber);

      scenes.forEach((scene: any, index: number) => {
        const sceneAudioPage = audioData.audioPages?.find((ap: any) => ap.scene_id === scene.id);

        pages.push({
          pageNumber: index + 2,
          pageType: 'scene',
          imageUrl: scene.images[0].imageUrl,
          textContent: scene.caption || scene.description,
          audioUrl: sceneAudioPage?.audio_url,
          audioDuration: sceneAudioPage?.audio_duration_seconds,
        });
      });

      setReadingPages(pages);
      setReadingMode(true);

    } catch (error) {
      console.error('Error loading reading mode:', error);
      alert('Failed to load reading mode. Please try again.');
    } finally {
      setLoadingAudio(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!project || !project.scenes || project.scenes.length === 0) {
      alert('No scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);

    try {
      // Prepare scenes data
      const scenesData = project.scenes
        .filter((scene: any) => scene.images && scene.images.length > 0)
        .map((scene: any) => ({
          sceneNumber: scene.sceneNumber,
          description: scene.description,
          imageUrl: scene.images[0].imageUrl,
        }));

      if (scenesData.length === 0) {
        alert('No scenes with images found');
        setGeneratingPDF(false);
        return;
      }

      // Format author string from project data or fallback to user
      let authorString = project.authorName || '';
      if (authorString && project.authorAge) {
        authorString += `, age ${project.authorAge}`;
      } else if (!authorString) {
        authorString = user?.name || 'My Family';
      }

      console.log('📄 PDF Download Data:');
      console.log('  - Title:', project.title);
      console.log('  - Author:', authorString);
      console.log('  - Cover URL:', project.coverImageUrl || 'NULL - will use fallback');
      console.log('  - Scenes:', scenesData.length);

      // Generate and download PDF
      await generateAndDownloadStoryPDF({
        title: project.title,
        description: project.description,
        coverImageUrl: project.coverImageUrl,
        scenes: scenesData,
        createdDate: new Date(project.createdAt).toLocaleDateString(),
        author: authorString,
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleTogglePublic = () => {
    const currentVisibility = project?.visibility || 'private';
    const newVisibility = currentVisibility === 'public' ? 'private' : 'public';

    // If going public, show confirmation
    if (newVisibility === 'public') {
      setShowPublicConfirm(true);
    } else {
      // Going private, no confirmation needed
      updateVisibility(newVisibility);
    }
  };

  const updateVisibility = async (newVisibility: 'public' | 'private') => {
    setUpdatingVisibility(true);
    setShowPublicConfirm(false);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: newVisibility }),
      });

      if (response.ok) {
        // Update local state
        setProject({ ...project, visibility: newVisibility });
        alert(newVisibility === 'public' ? '✅ Story is now public!' : '✅ Story is now private.');
      } else {
        const data = await response.json();
        alert(`Failed to update visibility: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating visibility:', error);
      alert('Failed to update visibility. Please try again.');
    } finally {
      setUpdatingVisibility(false);
    }
  };

  const handlePublishToSpotify = async () => {
    if (!project) return;

    const confirmed = confirm(
      'Publish to Spotify?\n\n' +
      'Your story will be published as an episode on the KindleWood Stories podcast. ' +
      'It will appear on Spotify within 1-6 hours.\n\n' +
      'Make sure you have generated audio for all scenes first.\n\n' +
      'Continue?'
    );

    if (!confirmed) return;

    setPublishingToSpotify(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/publish-spotify`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ ${data.message}`);
        setSpotifyStatus('published');
        await checkSpotifyStatus(); // Refresh status
      } else {
        alert(`❌ ${data.error}${data.details ? '\n\n' + data.details : ''}`);
      }
    } catch (error: any) {
      console.error('Spotify publishing error:', error);
      alert(`❌ Failed to publish to Spotify: ${error.message}`);
    } finally {
      setPublishingToSpotify(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading story...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return null;
  }

  const scenes = project.scenes || [];
  const currentScene = scenes[currentSceneIndex];
  const currentImage = currentScene?.images?.[0];

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Story Header */}
        <div className="mb-8">
          <Link href="/projects" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to My Stories
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{project.title}</h1>
          {project.description && (
            <p className="text-gray-600 text-lg">{project.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{scenes.length} scenes</span>
            <span>•</span>
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Story Viewer */}
        {scenes.length > 0 ? (
          <div className="space-y-6">
            {/* Scene Display with Overlay Controls */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image with Overlaid Navigation */}
              {currentImage?.imageUrl ? (
                <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={currentImage.imageUrl}
                    alt={`Scene ${currentSceneIndex + 1}`}
                    className="w-full h-full object-contain"
                  />

                  {/* Overlay Navigation */}
                  <div className="absolute inset-0 flex items-center justify-between px-4">
                    <button
                      onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))}
                      disabled={currentSceneIndex === 0}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <button
                      onClick={() => setCurrentSceneIndex(Math.min(scenes.length - 1, currentSceneIndex + 1))}
                      disabled={currentSceneIndex === scenes.length - 1}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Page Indicator */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black bg-opacity-60 px-4 py-2 rounded-full">
                    {scenes.map((_: any, index: number) => (
                      <button
                        key={index}
                        onClick={() => setCurrentSceneIndex(index)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          index === currentSceneIndex
                            ? 'bg-white w-6'
                            : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                        }`}
                      />
                    ))}
                  </div>

                  {/* Scene Counter */}
                  <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {currentSceneIndex + 1} / {scenes.length}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <div className="text-6xl">📖</div>
                </div>
              )}

              {/* Scene Text */}
              <div className="p-8">
                <p className="text-gray-800 text-lg leading-relaxed">
                  {currentScene?.description || 'No description available'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
              {/* Section 1: Story Actions */}
              <div className="mb-5">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Story Actions
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Read Mode */}
                  <Tooltip text="Read this story in fullscreen mode with narration">
                    <button
                      onClick={handleEnterReadingMode}
                      disabled={loadingAudio}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>📖</span>
                          <span>Read Mode</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Generate Audio / Audio Ready */}
                  <Tooltip text={hasAudio ? "Audio ready. Click to regenerate." : "Generate AI narration for this story"}>
                    <button
                      onClick={handleGenerateAudio}
                      disabled={generatingAudio}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        hasAudio
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                    >
                      {generatingAudio ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <span>🎵</span>
                          <span>{hasAudio ? 'Audio Ready ✓' : 'Generate Audio'}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Export PDF */}
                  <Tooltip text="Download this story as a PDF file">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={generatingPDF}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg hover:from-orange-700 hover:to-red-700 font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generatingPDF ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Exporting...</span>
                        </>
                      ) : (
                        <>
                          <span>📄</span>
                          <span>Export PDF</span>
                        </>
                      )}
                    </button>
                  </Tooltip>
                </div>
              </div>

              {/* Section 2: Publishing */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Publishing
                </h3>
                <div className="flex flex-wrap gap-2">
                  {/* Make Public / Private */}
                  <Tooltip text={project?.visibility === 'public' ? "Make this story private" : "Make this story visible to everyone"}>
                    <button
                      onClick={handleTogglePublic}
                      disabled={updatingVisibility}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        project?.visibility === 'public'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {updatingVisibility ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <span>{project?.visibility === 'public' ? '🌍' : '🔒'}</span>
                          <span>{project?.visibility === 'public' ? 'Public' : 'Make Public'}</span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Publish to Spotify */}
                  <Tooltip text={
                    spotifyStatus === 'live'
                      ? "Live on Spotify! Click to view"
                      : spotifyStatus === 'published'
                      ? "Published! Will appear on Spotify within 1-6 hours"
                      : spotifyStatus === 'compiling'
                      ? "Compiling audio for Spotify..."
                      : "Publish this story to Spotify as a podcast episode"
                  }>
                    <button
                      onClick={handlePublishToSpotify}
                      disabled={publishingToSpotify || ['compiling', 'published', 'live'].includes(spotifyStatus || '')}
                      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg font-medium shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        spotifyStatus === 'live'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : spotifyStatus === 'published'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : spotifyStatus === 'compiling'
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-500 text-white hover:bg-gray-600'
                      }`}
                    >
                      {publishingToSpotify ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Publishing...</span>
                        </>
                      ) : (
                        <>
                          <span>🎵</span>
                          <span>
                            {spotifyStatus === 'live'
                              ? 'On Spotify ✓'
                              : spotifyStatus === 'published'
                              ? 'Published'
                              : spotifyStatus === 'compiling'
                              ? 'Compiling...'
                              : 'Spotify'
                            }
                          </span>
                        </>
                      )}
                    </button>
                  </Tooltip>

                  {/* Kids App Placeholder */}
                  <Tooltip text="Publish this story to KindleWood Kids App (coming soon)">
                    <button
                      onClick={() => alert('Kids App publishing coming soon!')}
                      className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium shadow-md transition-all"
                    >
                      <span>📱</span>
                      <span>Kids App</span>
                    </button>
                  </Tooltip>

                  {/* Spacer to push delete to the right on desktop */}
                  <div className="flex-1 hidden sm:block"></div>

                  {/* Delete Story */}
                  <Tooltip text="Delete this story permanently">
                    <Link
                      href="/projects"
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium shadow-md transition-all"
                    >
                      <span>←</span>
                      <span className="hidden sm:inline">Back</span>
                    </Link>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              No Scenes Found
            </h2>
            <p className="text-gray-600">
              This story doesn't have any scenes yet.
            </p>
          </div>
        )}
      </div>

      {/* Reading Mode Viewer */}
      {readingMode && readingPages.length > 0 && (
        <ReadingModeViewer
          projectId={projectId}
          projectTitle={project?.title || 'Storybook'}
          pages={readingPages}
          onExit={() => setReadingMode(false)}
        />
      )}

      {/* Public Confirmation Modal */}
      {showPublicConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Make Story Public?</h3>
            <p className="text-gray-600 mb-4">
              Your story will be visible to everyone on the landing page and public gallery.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800 font-medium">
                💡 Important: Make sure your story doesn't contain personal information like addresses, phone numbers, or school names.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updateVisibility('public')}
                className="flex-1 bg-green-600 text-white px-6 py-3 rounded-xl hover:bg-green-700 font-semibold transition-all"
              >
                Make Public
              </button>
              <button
                onClick={() => setShowPublicConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
