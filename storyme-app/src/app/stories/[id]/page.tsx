/**
 * Public Story Viewer Page
 * View public stories without authentication
 * Includes reading mode and PDF download
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import ReadingModeViewer, { ReadingPage } from '@/components/story/ReadingModeViewer';
import ProfileMenu from '@/components/ui/ProfileMenu';

function StoryViewer() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const storyId = params.id as string;
  const fromCommunity = searchParams?.get('from') === 'community';

  const [user, setUser] = useState<any>(null);
  const [displayName, setDisplayName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<any>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [readingPages, setReadingPages] = useState<ReadingPage[]>([]);
  const [loadingReadingMode, setLoadingReadingMode] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        setDisplayName(user.user_metadata?.name || user.email?.split('@')[0] || 'User');
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    fetchStory();
  }, [storyId]);

  const fetchStory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stories/public/${storyId}`);
      const data = await response.json();

      if (response.ok && data.story) {
        setStory(data.story);
        // Check if audio exists
        await checkAudioExists();
      } else {
        setError(data.error || 'Failed to load story');
      }
    } catch (err) {
      console.error('Error fetching story:', err);
      setError('Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const checkAudioExists = async () => {
    try {
      const response = await fetch(`/api/projects/${storyId}/audio-pages`);
      const data = await response.json();
      setHasAudio(data.hasAudio || false);
    } catch (error) {
      console.error('Error checking audio:', error);
      setHasAudio(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!story) {
      alert('Story not loaded');
      return;
    }

    setGeneratingAudio(true);

    try {
      console.log('🎵 Starting audio generation...');

      const response = await fetch('/api/generate-story-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: storyId }),
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
    if (!story || !story.scenes || story.scenes.length === 0) {
      alert('No scenes available for reading mode');
      return;
    }

    setLoadingAudio(true);

    try {
      // Fetch audio pages
      const audioResponse = await fetch(`/api/projects/${storyId}/audio-pages`);
      const audioData = await audioResponse.json();

      // Build pages array
      const pages: ReadingPage[] = [];

      // Page 1: Cover page (use first scene image as cover if no cover exists)
      const coverImageUrl = story.scenes[0]?.imageUrl || '/api/placeholder/1024/1024';
      const coverText = story.title;

      const coverAudioPage = audioData.pages?.find((ap: any) => ap.page_type === 'cover');

      pages.push({
        pageNumber: 1,
        pageType: 'cover',
        imageUrl: coverImageUrl,
        textContent: coverText,
        audioUrl: coverAudioPage?.audio_url,
        audioDuration: coverAudioPage?.audio_duration_seconds,
      });

      // Pages 2+: Scene pages
      story.scenes.forEach((scene: any, index: number) => {
        const sceneAudioPage = audioData.pages?.find((ap: any) => ap.scene_id === scene.id);

        pages.push({
          pageNumber: index + 2,
          pageType: 'scene',
          imageUrl: scene.imageUrl || '/api/placeholder/1024/1024',
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
    if (!story || !story.scenes || story.scenes.length === 0) {
      alert('No scenes to generate PDF');
      return;
    }

    setGeneratingPDF(true);

    try {
      // Prepare scenes data
      const scenesData = story.scenes.map((scene: any) => ({
        sceneNumber: scene.sceneNumber,
        description: scene.description || scene.caption,
        imageUrl: scene.imageUrl,
      }));

      if (scenesData.length === 0) {
        alert('No scenes with images found');
        setGeneratingPDF(false);
        return;
      }

      // Generate and download PDF
      await generateAndDownloadStoryPDF({
        title: story.title,
        description: story.description,
        coverImageUrl: story.scenes[0]?.imageUrl,
        scenes: scenesData,
        createdDate: new Date(story.createdAt).toLocaleDateString(),
        author: 'StoryMe',
      });

    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
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

  if (error || !story) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md shadow-xl">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Story Not Found
          </h3>
          <p className="text-gray-600 mb-6">
            {error || 'This story may have been removed or made private.'}
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const scenes = story.scenes || [];
  const currentScene = scenes[currentSceneIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Header Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href={user ? "/dashboard" : "/"} className="text-2xl font-bold hover:opacity-80 transition-opacity">
                📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span> ✨
              </Link>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">BETA</span>
            </div>
            {user ? (
              <>
                <nav className="hidden md:flex space-x-6">
                  <Link
                    href="/dashboard"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/characters"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Characters
                  </Link>
                  <Link
                    href="/projects"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    My Stories
                  </Link>
                  <Link
                    href="/create"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Create Story
                  </Link>
                  <Link
                    href="/community-stories"
                    className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
                  >
                    Community Stories
                  </Link>
                </nav>
                <div className="flex items-center">
                  <ProfileMenu displayName={displayName} />
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link href="/stories" className="text-gray-600 hover:text-gray-900 font-medium">
                  Browse Stories
                </Link>
                <Link
                  href="/signup"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold transition-all shadow-lg"
                >
                  Create Your Story
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Story Header */}
        <div className="mb-8">
          <Link href={fromCommunity ? "/community-stories" : "/stories"} className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to Community Stories
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">{story.title}</h1>
          {story.description && (
            <p className="text-gray-600 text-lg">{story.description}</p>
          )}
          <div className="flex items-center gap-4 mt-4 text-sm text-gray-500">
            <span>{scenes.length} scenes</span>
            <span>•</span>
            <span>{story.viewCount || 0} views</span>
            {story.publishedAt && (
              <>
                <span>•</span>
                <span>{new Date(story.publishedAt).toLocaleDateString()}</span>
              </>
            )}
          </div>
        </div>

        {/* Story Viewer */}
        {scenes.length > 0 ? (
          <div className="space-y-6">
            {/* Scene Display with Overlay Controls */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image with Overlaid Navigation */}
              {currentScene?.imageUrl ? (
                <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={currentScene.imageUrl}
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
                  {currentScene?.caption || currentScene?.description || 'No description available'}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex gap-4 flex-wrap">
                <button
                  onClick={handleEnterReadingMode}
                  disabled={loadingAudio}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAudio ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : (
                    '📖 Reading Mode'
                  )}
                </button>
                {user && !hasAudio && (
                  <button
                    onClick={handleGenerateAudio}
                    disabled={generatingAudio}
                    className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-teal-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingAudio ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Generating Audio...
                      </span>
                    ) : (
                      '🎵 Generate Audio'
                    )}
                  </button>
                )}
                <button
                  onClick={handleDownloadPDF}
                  disabled={generatingPDF}
                  className="bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-3 rounded-xl hover:from-orange-700 hover:to-red-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingPDF ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating PDF...
                    </span>
                  ) : (
                    '📄 Download PDF'
                  )}
                </button>
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
          projectId={storyId}
          projectTitle={story?.title || 'Storybook'}
          pages={readingPages}
          onExit={() => setReadingMode(false)}
        />
      )}
    </div>
  );
}

export default function PublicStoryViewerPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading story...</p>
        </div>
      </div>
    }>
      <StoryViewer />
    </Suspense>
  );
}
