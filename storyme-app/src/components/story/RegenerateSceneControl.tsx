/**
 * Regenerate Scene Control Component
 *
 * Allows users to view and edit the AI prompt for a scene,
 * then regenerate the image with the modified prompt.
 */

'use client';

import { useState } from 'react';
import { Character } from '@/lib/types/story';

interface RegenerateSceneControlProps {
  sceneId: string;
  sceneNumber: number;
  originalPrompt: string;
  sceneDescription: string;
  characters: Character[];
  artStyle?: string;
  onRegenerate: (newImageData: any) => void;
}

export default function RegenerateSceneControl({
  sceneId,
  sceneNumber,
  originalPrompt,
  sceneDescription,
  characters,
  artStyle,
  onRegenerate,
}: RegenerateSceneControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userFeedback, setUserFeedback] = useState('');
  const [editedPrompt, setEditedPrompt] = useState(originalPrompt);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!userFeedback.trim()) {
      setError('Please tell us what to improve about this scene');
      return;
    }

    if (userFeedback.trim().length < 10) {
      setError('Please provide more detail about what to improve (at least 10 characters)');
      return;
    }

    setIsRegenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId,
          sceneNumber,
          userFeedback: userFeedback.trim(),
          editedPrompt: editedPrompt.trim(),
          originalPrompt,
          originalSceneDescription: sceneDescription,
          characters,
          artStyle,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to regenerate');
      }

      if (data.success) {
        // Pass the new image data to parent
        onRegenerate(data.generatedImage);

        // Close the panel
        setIsExpanded(false);

        // Show success notification (brief)
        console.log('✅ Scene regenerated successfully!');
      } else {
        throw new Error(data.error || 'Regeneration failed');
      }
    } catch (err) {
      console.error('Regeneration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to regenerate image');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setUserFeedback(''); // Clear feedback
    setError(null);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md hover:bg-purple-100 hover:border-purple-300 transition-colors text-sm font-medium"
      >
        Regenerate Scene
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3 space-y-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          Tell us what to improve
        </h4>
        <button
          onClick={handleCancel}
          disabled={isRegenerating}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* User Feedback Input */}
      <div>
        <label htmlFor="user-feedback" className="text-xs font-medium text-gray-700 mb-1 block">
          What to improve:
        </label>
        <textarea
          id="user-feedback"
          value={userFeedback}
          onChange={(e) => setUserFeedback(e.target.value)}
          disabled={isRegenerating}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          placeholder="e.g., Remove extra person, fix hand position, add more trees..."
          required
        />
        <p className="text-xs text-gray-500 mt-1.5">
          💡 Describe what to fix: extra objects, wrong anatomy, missing items, expressions, etc.
        </p>
      </div>

      {/* Image Prompt Editor */}
      <div>
        <label htmlFor="image-prompt" className="text-xs font-medium text-gray-700 mb-1 block">
          Image generation prompt:
        </label>
        <textarea
          id="image-prompt"
          value={editedPrompt}
          onChange={(e) => {
            setEditedPrompt(e.target.value);
            // Auto-resize textarea based on content
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onFocus={(e) => {
            // Set initial height on focus
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          disabled={isRegenerating}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none overflow-hidden"
          style={{ minHeight: '4rem' }}
        />
        <p className="text-xs text-gray-500 mt-1.5">
          ✏️ You can directly edit the AI prompt used for image generation
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-2">
          <p className="text-xs text-red-600 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating || !userFeedback.trim()}
          className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-md hover:from-purple-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
        >
          {isRegenerating ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <span>Regenerate</span>
          )}
        </button>

        <button
          onClick={handleCancel}
          disabled={isRegenerating}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Generating Status */}
      {isRegenerating && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
          <p className="text-xs text-blue-700">
            ⏳ Generating new image... This may take 15-30 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
