/**
 * Edit Image Control Component
 *
 * Reusable component for editing scene images and cover images using Qwen-Image-Edit.
 * Provides a simple UI for entering edit instructions and applying changes.
 */

'use client';

import { useState } from 'react';

interface EditImageControlProps {
  currentImageUrl: string;
  imageType: 'scene' | 'cover';
  imageId: string;
  onEditComplete: (newImageUrl: string) => void;
  buttonLabel?: string;
}

export default function EditImageControl({
  currentImageUrl,
  imageType,
  imageId,
  onEditComplete,
  buttonLabel = 'Edit Image',
}: EditImageControlProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!instruction.trim()) {
      setError('Please describe what you want to change');
      return;
    }

    if (instruction.trim().length < 5) {
      setError('Please provide more detail (at least 5 characters)');
      return;
    }

    setIsEditing(true);
    setError(null);

    try {
      const response = await fetch('/api/edit-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: currentImageUrl,
          instruction: instruction.trim(),
          imageType,
          imageId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to edit image');
      }

      // Success - pass new image URL to parent
      onEditComplete(data.imageUrl);

      // Reset and close
      setInstruction('');
      setIsExpanded(false);

      console.log(`✅ Image edited successfully in ${data.generationTime}s`);

    } catch (err) {
      console.error('Edit image error:', err);
      setError(err instanceof Error ? err.message : 'Failed to edit image. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setInstruction('');
    setError(null);
  };

  // Collapsed state - just show button
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors text-sm font-medium"
      >
        ✏️ {buttonLabel}
      </button>
    );
  }

  // Expanded state - show edit form
  return (
    <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 space-y-2.5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900">
          What would you like to change?
        </h4>
        <button
          onClick={handleCancel}
          disabled={isEditing}
          className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Instruction Input */}
      <div>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          disabled={isEditing}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
          placeholder="e.g., remove the cat in background, add a tree, change expression to happy..."
        />
        <p className="text-xs text-gray-500 mt-1.5">
          💡 Describe what to add, remove, or change in the image
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
          onClick={handleEdit}
          disabled={isEditing || !instruction.trim()}
          className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-sm"
        >
          {isEditing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Applying...</span>
            </>
          ) : (
            <span>Apply Edit</span>
          )}
        </button>

        <button
          onClick={handleCancel}
          disabled={isEditing}
          className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Cancel
        </button>
      </div>

      {/* Processing Status */}
      {isEditing && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-2">
          <p className="text-xs text-blue-700">
            ⏳ Editing image... This may take 10-30 seconds.
          </p>
        </div>
      )}
    </div>
  );
}
