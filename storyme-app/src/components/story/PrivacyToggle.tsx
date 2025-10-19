/**
 * Privacy Toggle Component
 * Allows users to switch between private and public visibility for their stories
 * IMPORTANT: Defaults to 'private' for user safety
 */

'use client';

import { useState } from 'react';
import type { StoryVisibility } from '@/lib/types/story';

interface PrivacyToggleProps {
  visibility: StoryVisibility;
  onChange: (visibility: StoryVisibility) => void;
  disabled?: boolean;
  viewCount?: number;
  shareCount?: number;
  publicUrl?: string;
  showStats?: boolean;
}

export default function PrivacyToggle({
  visibility,
  onChange,
  disabled = false,
  viewCount = 0,
  shareCount = 0,
  publicUrl,
  showStats = true,
}: PrivacyToggleProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [copied, setCopied] = useState(false);

  const isPublic = visibility === 'public';

  const handleToggle = () => {
    if (isPublic) {
      // Switching from public to private - direct change
      onChange('private');
    } else {
      // Switching from private to public - show confirmation
      setShowConfirmation(true);
    }
  };

  const confirmMakePublic = () => {
    onChange('public');
    setShowConfirmation(false);
  };

  const copyPublicUrl = async () => {
    if (publicUrl) {
      try {
        await navigator.clipboard.writeText(publicUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy URL:', err);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <span className="text-xl">{isPublic ? '🌍' : '🔒'}</span>
          Story Privacy
        </h3>

        {/* Toggle Switch */}
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
            isPublic
              ? 'bg-green-500 focus:ring-green-500'
              : 'bg-gray-300 focus:ring-gray-400'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform duration-200 ${
              isPublic ? 'translate-x-9' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Status Info */}
      <div className="space-y-3">
        <div className={`rounded-lg p-3 ${isPublic ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
          <div className="flex items-start gap-2">
            <span className="text-lg">{isPublic ? '✓' : '✓'}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900 mb-1">
                {isPublic ? 'Public Story' : 'Private Story'}
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                {isPublic ? (
                  <>
                    <li>✓ Visible to everyone</li>
                    <li>✓ Appears in public gallery</li>
                    <li>✓ Can be shared on social media</li>
                  </>
                ) : (
                  <>
                    <li>✓ Only you can see this story</li>
                    <li>✗ Not visible on landing page</li>
                    <li>✗ Cannot be shared publicly</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Public Story Stats & URL */}
        {isPublic && showStats && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <span>👁️</span>
                <span className="font-medium">{viewCount}</span>
                <span className="text-xs">views</span>
              </div>
              <div className="flex items-center gap-1 text-gray-600">
                <span>📤</span>
                <span className="font-medium">{shareCount}</span>
                <span className="text-xs">shares</span>
              </div>
            </div>

            {/* Public URL */}
            {publicUrl && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <label className="text-xs font-medium text-blue-900 mb-1 block">
                  Public Link:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={publicUrl}
                    readOnly
                    className="flex-1 text-xs bg-white border border-blue-300 rounded px-2 py-1 text-gray-700 font-mono"
                  />
                  <button
                    onClick={copyPublicUrl}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="mb-4">
              <div className="text-4xl mb-3">🌍</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                Make this story public?
              </h3>
              <p className="text-gray-600 text-sm">
                Your story will be visible to everyone and appear on the StoryMe landing page.
              </p>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <ul className="text-sm text-gray-700 space-y-1">
                <li>✓ Your story will appear on the StoryMe landing page</li>
                <li>✓ Anyone can view your story</li>
                <li>✓ You can change this back to private anytime</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5">
              <p className="text-xs text-yellow-800">
                <strong>Note:</strong> Make sure your story doesn't contain personal information like addresses, phone numbers, or last names.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmMakePublic}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold transition-colors"
              >
                Make Public
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
