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
import AudioRecorder, { RecordingPage } from '@/components/story/AudioRecorder';
import LandingNav from '@/components/navigation/LandingNav';
import AppPromoBanner from '@/components/promotion/AppPromoBanner';

function StoryViewer() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const storyId = params.id as string;

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
  const [showRecorder, setShowRecorder] = useState(false);
  const [recordingPages, setRecordingPages] = useState<RecordingPage[]>([]);
  const [uploadingAudio, setUploadingAudio] = useState(false);

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

  // Auto-enter reading mode if URL has ?mode=reading
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'reading' && story && story.scenes && story.scenes.length > 0 && !readingMode && !loadingAudio) {
      handleEnterReadingMode();
    }
  }, [story, searchParams, readingMode, loadingAudio]);

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

  const handleRecordAudio = async () => {
    if (!story || !story.scenes || story.scenes.length === 0) {
      alert('No scenes available to record audio');
      return;
    }

    if (!user) {
      alert('Please sign in to record audio for your story');
      return;
    }

    // Build recording pages
    const pages: RecordingPage[] = [];

    // Page 1: Cover page
    const coverImageUrl = story.scenes[0]?.imageUrl || '/api/placeholder/1024/1024';
    const coverText = story.author_name && story.author_age
      ? `${story.title}, by ${story.author_name}, age ${story.author_age}`
      : story.author_name
      ? `${story.title}, by ${story.author_name}`
      : story.title;

    pages.push({
      pageNumber: 1,
      pageType: 'cover',
      imageUrl: coverImageUrl,
      textContent: coverText,
    });

    // Pages 2+: Scene pages
    story.scenes.forEach((scene: any, index: number) => {
      pages.push({
        pageNumber: index + 2,
        pageType: 'scene',
        imageUrl: scene.imageUrl || '/api/placeholder/1024/1024',
        textContent: scene.caption || scene.description,
        textContentChinese: scene.captionChinese,
        sceneId: scene.id,
      });
    });

    setRecordingPages(pages);
    setShowRecorder(true);
  };

  const handleUploadRecordings = async (recordings: any[], language: 'en' | 'zh' = 'en') => {
    setUploadingAudio(true);

    try {
      console.log(`🎙️ Uploading ${recordings.length} ${language.toUpperCase()} audio recordings...`);

      // Prepare form data
      const formData = new FormData();
      formData.append('projectId', storyId);
      formData.append('language', language);
      formData.append('voiceProfileName', `${displayName}'s Voice`);

      // Build metadata array
      const metadata = recordings.map((rec, index) => {
        const page = recordingPages.find(p => p.pageNumber === rec.pageNumber);
        return {
          pageNumber: rec.pageNumber,
          pageType: page?.pageType || 'scene',
          sceneId: page?.sceneId,
          quizQuestionId: page?.quizQuestionId,
          textContent: page?.textContent || '',
          duration: rec.duration,
        };
      });

      formData.append('audioMetadata', JSON.stringify(metadata));

      // Append audio files
      recordings.forEach((rec) => {
        formData.append(`audio_${rec.pageNumber}`, rec.audioBlob, `page-${rec.pageNumber}.webm`);
      });

      // Upload
      const response = await fetch('/api/upload-user-audio', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.success) {
        alert(`✅ Success! ${data.successfulPages} pages uploaded.\n\nYour voice is now part of the story!`);
        setShowRecorder(false);
        setHasAudio(true);
        await checkAudioExists();
      } else {
        console.error('Upload failed:', data);
        alert(`❌ Upload failed: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`❌ Error uploading audio: ${error.message || 'Unknown error'}`);
    } finally {
      setUploadingAudio(false);
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

      // Page 1: Cover page (use actual cover image, fallback to first scene)
      const coverImageUrl = story.coverImageUrl || story.scenes[0]?.imageUrl || '/api/placeholder/1024/1024';

      // Build cover text with author info
      let coverText = story.title;
      if (story.authorName && story.authorAge) {
        coverText = `${story.title}\n\nby ${story.authorName}, age ${story.authorAge}`;
      } else if (story.authorName) {
        coverText = `${story.title}\n\nby ${story.authorName}`;
      }

      const coverAudioPage = audioData.pages?.find((ap: any) => ap.page_type === 'cover');

      pages.push({
        pageNumber: 1,
        pageType: 'cover',
        imageUrl: coverImageUrl,
        textContent: coverText,
        audioUrl: coverAudioPage?.audio_url,
        audioUrlZh: coverAudioPage?.audio_url_zh,
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
          textContentChinese: scene.captionChinese,
          audioUrl: sceneAudioPage?.audio_url,
          audioUrlZh: sceneAudioPage?.audio_url_zh,
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
      // Prepare scenes data - MUST sort by sceneNumber to ensure correct page order
      const scenesData = story.scenes
        .sort((a: any, b: any) => a.sceneNumber - b.sceneNumber)
        .map((scene: any) => ({
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

  // IMPORTANT: Sort scenes by sceneNumber to ensure correct page order
  const scenes = (story.scenes || []).sort((a: any, b: any) => a.sceneNumber - b.sceneNumber);

  // Build pages array with cover page first
  const allPages = [
    {
      type: 'cover',
      imageUrl: story.coverImageUrl || scenes[0]?.imageUrl,
      title: story.title,
      authorName: story.authorName,
      authorAge: story.authorAge,
    },
    ...scenes.map((scene: any) => ({
      type: 'scene',
      ...scene,
    })),
  ];

  const currentPage = allPages[currentSceneIndex];
  const isCoverPage = currentPage?.type === 'cover';

  // This page is for community/public stories only (route: /stories/[id])
  // My Stories use a different route (/projects/[id])
  // Therefore, we should ALWAYS hide Record Audio and Download PDF buttons on this page
  const isCommunityStory = true;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Navigation */}
      <LandingNav />

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Story Header */}
        <div className="mb-8">
          <Link href="/stories" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
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
        {allPages.length > 0 ? (
          <div className="space-y-6">
            {/* Scene Display with Overlay Controls */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image with Overlaid Navigation */}
              {currentPage?.imageUrl ? (
                <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={currentPage.imageUrl}
                    alt={isCoverPage ? 'Cover' : `Scene ${currentSceneIndex}`}
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
                      onClick={() => setCurrentSceneIndex(Math.min(allPages.length - 1, currentSceneIndex + 1))}
                      disabled={currentSceneIndex === allPages.length - 1}
                      className="bg-black bg-opacity-60 hover:bg-opacity-80 text-white p-4 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>

                  {/* Page Indicator */}
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 bg-black bg-opacity-60 px-4 py-2 rounded-full">
                    {allPages.map((_: any, index: number) => (
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

                  {/* Page Counter */}
                  <div className="absolute top-4 right-4 bg-black bg-opacity-60 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    {isCoverPage ? 'Cover' : `${currentSceneIndex} / ${scenes.length}`}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <div className="text-6xl">📖</div>
                </div>
              )}

              {/* Page Text */}
              <div className="p-8">
                {isCoverPage ? (
                  <div className="text-center">
                    <h2 className="text-gray-900 text-2xl font-bold mb-2">{currentPage.title}</h2>
                    {currentPage.authorName && (
                      <p className="text-gray-600 text-lg">
                        by {currentPage.authorName}
                        {currentPage.authorAge && `, age ${currentPage.authorAge}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-800 text-lg leading-relaxed">
                      {currentPage?.caption || currentPage?.description || 'No description available'}
                    </p>
                    {currentPage?.captionChinese && (
                      <p className="text-gray-500 text-base leading-relaxed mt-2">
                        {currentPage.captionChinese}
                      </p>
                    )}
                  </div>
                )}
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
                {/* Only show Record Audio and Generate AI Audio if NOT community story */}
                {user && !isCommunityStory && (
                  <>
                    <button
                      onClick={handleRecordAudio}
                      disabled={uploadingAudio}
                      className="bg-gradient-to-r from-red-500 to-pink-500 text-white px-6 py-3 rounded-xl hover:from-red-600 hover:to-pink-600 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingAudio ? (
                        <span className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </span>
                      ) : (
                        '🎙️ Record Your Voice'
                      )}
                    </button>
                    {!hasAudio && (
                      <button
                        onClick={handleGenerateAudio}
                        disabled={generatingAudio}
                        className="bg-gradient-to-r from-green-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-teal-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingAudio ? (
                          <span className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Generating...
                          </span>
                        ) : (
                          '🤖 Generate AI Audio'
                        )}
                      </button>
                    )}
                  </>
                )}
                {/* Only show Download PDF if NOT community story */}
                {!isCommunityStory && (
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
                )}
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

        {/* App Promotion Banner */}
        <div className="mt-8">
          <AppPromoBanner isLoggedIn={!!user} variant="inline" />
        </div>
      </div>

      {/* Reading Mode Viewer */}
      {readingMode && readingPages.length > 0 && (
        <ReadingModeViewer
          projectId={storyId}
          projectTitle={story?.title || 'Storybook'}
          pages={readingPages}
          onExit={() => setReadingMode(false)}
          autoPlayAudio={searchParams.get('mode') === 'reading'}
        />
      )}

      {/* Audio Recorder */}
      {showRecorder && recordingPages.length > 0 && (
        <AudioRecorder
          projectId={storyId}
          projectTitle={story?.title || 'Your Story'}
          pages={recordingPages}
          onComplete={handleUploadRecordings}
          onExit={() => setShowRecorder(false)}
          defaultLanguage={
            story?.scenes?.some((scene: any) => scene.captionChinese)
              ? 'zh'
              : 'en'
          }
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
