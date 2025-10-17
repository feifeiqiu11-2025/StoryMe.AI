'use client';

import { useState } from 'react';
import StarRating from '@/components/ui/StarRating';

interface SceneRatingCardProps {
  imageId: string;
  sceneNumber: number;
  initialRatings?: {
    overallRating?: number;
    ratingFeedback?: string;
  };
  onSave?: (ratings: {
    overallRating: number;
    ratingFeedback?: string;
  }) => Promise<void>;
  readonly?: boolean;
}

export default function SceneRatingCard({
  imageId,
  sceneNumber,
  initialRatings,
  onSave,
  readonly = false,
}: SceneRatingCardProps) {
  const [overallRating, setOverallRating] = useState(initialRatings?.overallRating || 0);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if already rated
  const hasRating = initialRatings?.overallRating !== undefined;

  // Auto-save when rating changes
  const handleRatingChange = async (newRating: number) => {
    setOverallRating(newRating);

    if (!onSave || newRating === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        overallRating: newRating,
      });
      setSaveSuccess(true);
      setShowForm(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save rating:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Display mode (readonly or already rated)
  if (readonly || (hasRating && !showForm)) {
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700">Scene {sceneNumber} Rating</h4>
          {!readonly && hasRating && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Edit Rating
            </button>
          )}
        </div>
        <div className="space-y-2">
          <StarRating
            label="Overall Rating:"
            value={initialRatings?.overallRating}
            readonly
            size="md"
          />
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="bg-white rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-900">
          Rate This Scene {saveSuccess && <span className="text-green-600 ml-2">✓ Saved!</span>}
        </h4>
        {showForm && hasRating && (
          <button
            onClick={() => setShowForm(false)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        )}
      </div>

      <div>
        {/* Overall Rating */}
        <StarRating
          label="Overall Rating:"
          value={overallRating}
          onChange={handleRatingChange}
          size="lg"
          showValue={false}
        />
        {isSaving && (
          <p className="text-xs text-gray-500 mt-1">Saving...</p>
        )}
      </div>
    </div>
  );
}
