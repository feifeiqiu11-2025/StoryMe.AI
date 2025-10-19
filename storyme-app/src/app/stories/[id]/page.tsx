/**
 * Public Story Viewer Page
 * View public stories without authentication
 * Includes reading mode and PDF download
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { generateAndDownloadStoryPDF } from '@/lib/services/pdf.service';
import ReadingModeViewer, { ReadingPage } from '@/components/story/ReadingModeViewer';
import SocialShareButtons from '@/components/story/SocialShareButtons';

export default function PublicStoryViewerPage() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState<any>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [readingMode, setReadingMode] = useState(false);
  const [readingPages, setReadingPages] = useState<ReadingPage[]>([]);
  const [loadingReadingMode, setLoadingReadingMode] = useState(false);

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

  const handleEnterReadingMode = async () => {
    if (!story || !story.scenes || story.scenes.length === 0) {
      alert('No scenes available for reading mode');
      return;
    }

    setLoadingReadingMode(true);

    try {
      // Build pages array
      const pages: ReadingPage[] = [];

      // Page 1: Cover page (use first scene image as cover if no cover exists)
      const coverImageUrl = story.scenes[0]?.imageUrl || '/api/placeholder/1024/1024';
      const coverText = story.title;

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
        });
      });

      setReadingPages(pages);
      setReadingMode(true);

    } catch (error) {
      console.error('Error loading reading mode:', error);
      alert('Failed to load reading mode. Please try again.');
    } finally {
      setLoadingReadingMode(false);
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold">
            Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span>
          </Link>
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
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Story Header */}
        <div className="mb-8">
          <Link href="/stories" className="text-blue-600 hover:text-blue-700 font-medium mb-4 inline-block">
            ← Back to Gallery
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
            {/* Scene Display */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
              {/* Image */}
              {currentScene?.imageUrl ? (
                <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                  <img
                    src={currentScene.imageUrl}
                    alt={`Scene ${currentSceneIndex + 1}`}
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                    Scene {currentSceneIndex + 1} of {scenes.length}
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

            {/* Navigation Controls */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => setCurrentSceneIndex(Math.max(0, currentSceneIndex - 1))}
                  disabled={currentSceneIndex === 0}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>

                <div className="flex gap-2">
                  {scenes.map((_: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSceneIndex(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentSceneIndex
                          ? 'bg-blue-600 w-8'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                    />
                  ))}
                </div>

                <button
                  onClick={() => setCurrentSceneIndex(Math.min(scenes.length - 1, currentSceneIndex + 1))}
                  disabled={currentSceneIndex === scenes.length - 1}
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl shadow-xl p-6">
              <div className="flex gap-4 flex-wrap mb-4">
                <button
                  onClick={handleEnterReadingMode}
                  disabled={loadingReadingMode}
                  className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-blue-700 font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingReadingMode ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Loading...
                    </span>
                  ) : (
                    '📖 Reading Mode'
                  )}
                </button>
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

              {/* Social Share */}
              <div className="border-t border-gray-200 pt-4">
                <SocialShareButtons
                  storyId={story.id}
                  storyTitle={story.title}
                  storyUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/stories/${story.id}`}
                />
              </div>
            </div>

            {/* CTA */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white text-center">
              <h3 className="text-3xl font-bold mb-2">
                ✨ Create Your Own Story
              </h3>
              <p className="text-blue-100 mb-6 text-lg">
                Turn your child's imagination into a beautiful storybook!
              </p>
              <Link
                href="/signup"
                className="inline-block bg-white text-purple-600 px-8 py-4 rounded-xl hover:bg-gray-50 font-semibold transition-all shadow-lg text-lg"
              >
                Get Started - It's Free
              </Link>
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
