/**
 * GuestStoryRestorer Component
 *
 * Shows a banner after user authentication if there's a saved guest story,
 * and provides a button to save it to their account.
 */

'use client';

import { useState, useEffect } from 'react';
import { hasGuestStory, saveGuestStoryToAccount, clearGuestStory, getGuestStory } from '@/lib/utils/guest-story-storage';
import { createClient } from '@/lib/supabase/client';

export default function GuestStoryRestorer() {
  const [showBanner, setShowBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const checkForGuestStory = async () => {
      // Check if user is authenticated
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user && hasGuestStory()) {
        const story = getGuestStory();
        // Only show if story has generated images (completed)
        if (story && story.generatedImages.length > 0) {
          setShowBanner(true);
        }
      }
    };

    checkForGuestStory();
  }, []);

  const handleSaveStory = async () => {
    setSaving(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const success = await saveGuestStoryToAccount(user.id);

      if (success) {
        setSaved(true);
        setTimeout(() => {
          setShowBanner(false);
        }, 3000); // Hide banner after 3 seconds
      } else {
        setError('Failed to save story. Please try again.');
      }
    } catch (err) {
      console.error('Error saving guest story:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = () => {
    clearGuestStory();
    setShowBanner(false);
  };

  if (!showBanner) return null;

  if (saved) {
    return (
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-lg z-50 animate-slide-down">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-green-800">
              Story saved successfully!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg shadow-lg z-50 animate-slide-down">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800">
            Welcome back!
          </h3>
          <p className="mt-1 text-sm text-blue-700">
            We found your story from guest mode. Save it to your account?
          </p>
          {error && (
            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSaveStory}
              disabled={saving}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Story'}
            </button>
            <button
              onClick={handleDismiss}
              disabled={saving}
              className="px-3 py-1.5 bg-white text-blue-600 text-sm font-medium rounded border border-blue-300 hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
