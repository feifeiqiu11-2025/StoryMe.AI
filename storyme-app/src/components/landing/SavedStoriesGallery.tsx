'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { ProjectWithScenesDTO } from '@/lib/domain/dtos';

export default function SavedStoriesGallery() {
  const [stories, setStories] = useState<ProjectWithScenesDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStories() {
      try {
        const response = await fetch('/api/projects/public');
        if (!response.ok) {
          throw new Error('Failed to fetch stories');
        }
        const data = await response.json();
        setStories(data.projects || []);
      } catch (err) {
        console.error('Error fetching stories:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stories');
      } finally {
        setLoading(false);
      }
    }

    fetchStories();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600">Loading saved stories...</p>
      </div>
    );
  }

  if (error || stories.length === 0) {
    return null; // Don't show the section if there are no stories or error
  }

  return (
    <div className="mb-12 sm:mb-16">
      <div className="text-center mb-8 sm:mb-12">
        <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3 flex items-center justify-center gap-3">
          <span className="text-4xl">📚</span>
          <span>Story Gallery</span>
        </h2>
        <p className="text-gray-600 text-lg max-w-2xl mx-auto">
          See amazing stories created by our community
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
        {stories.map((story) => {
          // Get the cover image from the first scene
          const coverScene = story.scenes?.[0];
          const coverImage = coverScene?.imageUrl;

          return (
            <div
              key={story.id}
              className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-gray-100"
            >
              {/* Cover Image */}
              <div className="relative h-64 sm:h-72 bg-gradient-to-br from-blue-50 to-purple-50">
                {coverImage ? (
                  <Image
                    src={coverImage}
                    alt={story.title || 'Story cover'}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-6xl">
                    📖
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-xl font-bold text-gray-900 flex-1">
                    {story.title || 'Untitled Story'}
                  </h3>
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium ml-2">
                    Story
                  </span>
                </div>

                {story.description && (
                  <p className="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-3">
                    {story.description}
                  </p>
                )}

                {/* Scene Preview */}
                {story.scenes && story.scenes.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {story.scenes.slice(0, 3).map((scene, idx) => (
                      <div
                        key={scene.id || idx}
                        className="relative h-20 rounded-lg overflow-hidden bg-gray-100"
                      >
                        {scene.imageUrl ? (
                          <Image
                            src={scene.imageUrl}
                            alt={`Scene ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🎨
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-500">
                    {story.scenes?.length || 0} scene{(story.scenes?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(story.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Your Story CTA */}
      <div className="text-center mt-8 sm:mt-12">
        <p className="text-gray-600 mb-4 text-base sm:text-lg">
          Want to create your own amazing storybook?
        </p>
        <Link
          href="/guest"
          className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-purple-700 font-semibold shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
        >
          Create Your Storybook
        </Link>
      </div>
    </div>
  );
}
