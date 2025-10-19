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
  const [editedPrompt, setEditedPrompt] = useState(originalPrompt);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!editedPrompt.trim()) {
      setError('Prompt cannot be empty');
      return;
    }

    if (editedPrompt.trim().length < 10) {
      setError('Prompt is too short. Please provide more detail.');
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
          customPrompt: editedPrompt.trim(),
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
    setEditedPrompt(originalPrompt); // Reset to original
    setError(null);
  };

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium shadow-md hover:shadow-lg flex items-center gap-2"
      >
        <span className="text-lg">⚡</span>
        Regenerate Scene
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span className="text-xl">🎨</span>
          Customize & Regenerate Scene {sceneNumber}
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

      {/* Editable Prompt - Single field */}
      <div className="space-y-2">
        <label htmlFor="edited-prompt" className="block text-sm font-semibold text-gray-700">
          AI Prompt:
        </label>
        <textarea
          id="edited-prompt"
          value={editedPrompt}
          onChange={(e) => setEditedPrompt(e.target.value)}
          disabled={isRegenerating}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          placeholder="Edit the AI prompt to improve this scene..."
        />
        <p className="text-xs text-gray-500">
          💡 Be specific about character poses, expressions, actions, and background details.
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600 font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating || !editedPrompt.trim()}
          className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          {isRegenerating ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>🔄</span>
              <span>Regenerate</span>
            </>
          )}
        </button>

        <button
          onClick={handleCancel}
          disabled={isRegenerating}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Generating Status */}
      {isRegenerating && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
          <div className="text-xs text-blue-700 font-medium flex items-center gap-2">
            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            Generating new image... This may take 15-30 seconds.
          </div>
        </div>
      )}
    </div>
  );
}
