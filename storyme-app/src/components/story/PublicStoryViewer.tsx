/**
 * Public Story Viewer Modal
 * Full-screen modal for viewing public stories
 * Shows all scenes with pagination and social sharing
 */

'use client';

import { useState, useEffect } from 'react';
import SocialShareButtons from './SocialShareButtons';

interface PublicStoryViewerProps {
  storyId: string;
  onClose: () => void;
}

interface Scene {
  id: string;
  sceneNumber: number;
  description: string;
  caption: string;
  images?: Array<{
    id: string;
    imageUrl: string;
  }>;
}

interface StoryData {
  id: string;
  title: string;
  description?: string;
  authorName?: string;
  authorAge?: number;
  viewCount: number;
  shareCount: number;
  publishedAt: string;
  scenes: Scene[];
}

export default function PublicStoryViewer({ storyId, onClose }: PublicStoryViewerProps) {
  const [story, setStory] = useState<StoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);

  useEffect(() => {
    fetchStory();
  }, [storyId]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const fetchStory = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/stories/public/${storyId}`);
      const data = await response.json();

      if (response.ok && data.story) {
        setStory(data.story);
      } else {
        throw new Error(data.error || 'Failed to load story');
      }
    } catch (err) {
      console.error('Error fetching story:', err);
      setError(err instanceof Error ? err.message : 'Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    setCurrentSceneIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    if (story) {
      setCurrentSceneIndex((prev) => Math.min(story.scenes.length - 1, prev + 1));
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-12 text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading story...</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            Story Not Found
          </h3>
          <p className="text-gray-600 mb-6">
            {error || 'This story may have been removed or made private.'}
          </p>
          <button
            onClick={onClose}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const currentScene = story.scenes[currentSceneIndex];
  const currentImage = currentScene?.images?.[0];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 overflow-y-auto">
      <div className="min-h-screen p-4 sm:p-6">
        {/* Header Bar */}
        <div className="max-w-5xl mx-auto mb-4 flex items-center justify-between bg-white bg-opacity-10 backdrop-blur-sm rounded-xl p-4">
          <div className="text-white">
            <h2 className="text-xl sm:text-2xl font-bold">{story.title}</h2>
            {story.authorName && (
              <p className="text-sm text-gray-300">
                by {story.authorName}
                {story.authorAge && `, age ${story.authorAge}`}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-300 transition-colors p-2"
            aria-label="Close"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Main Content */}
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Scene Display */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Image */}
            {currentImage?.imageUrl ? (
              <div className="relative aspect-video bg-gradient-to-br from-blue-100 to-purple-100">
                <img
                  src={currentImage.imageUrl}
                  alt={`Scene ${currentSceneIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Scene {currentSceneIndex + 1} of {story.scenes.length}
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
                {currentScene?.caption || currentScene?.description || 'No caption available'}
              </p>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <button
                onClick={handlePrevious}
                disabled={currentSceneIndex === 0}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ← Previous
              </button>

              <div className="flex gap-2">
                {story.scenes.map((_, index) => (
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
                onClick={handleNext}
                disabled={currentSceneIndex === story.scenes.length - 1}
                className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>

            {/* Social Share Buttons */}
            <div className="border-t border-gray-200 pt-4">
              <SocialShareButtons
                storyId={story.id}
                storyTitle={story.title}
                storyUrl={`${window.location.origin}/stories/${story.id}`}
              />
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-6 text-white text-center">
            <h3 className="text-2xl font-bold mb-2">
              ✨ Create Your Own Story
            </h3>
            <p className="text-blue-100 mb-4">
              Turn your child's imagination into a beautiful storybook!
            </p>
            <a
              href="/signup"
              className="inline-block bg-white text-purple-600 px-8 py-3 rounded-xl hover:bg-gray-50 font-semibold transition-all shadow-lg"
            >
              Get Started - It's Free
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
