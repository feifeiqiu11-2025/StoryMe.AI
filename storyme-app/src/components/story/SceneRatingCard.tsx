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
  const [feedback, setFeedback] = useState(initialRatings?.ratingFeedback || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Check if already rated
  const hasRating = initialRatings?.overallRating !== undefined;

  const handleSave = async () => {
    if (!onSave || overallRating === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        overallRating,
        ratingFeedback: feedback || undefined,
      });
      setSaveSuccess(true);
      setShowForm(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save rating:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const canSubmit = overallRating > 0;

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
          {initialRatings?.ratingFeedback && (
            <div className="mt-2 pt-2 border-t border-blue-200">
              <p className="text-xs text-gray-600 italic">"{initialRatings.ratingFeedback}"</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Edit mode
  return (
    <div className="bg-white border-2 border-blue-300 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
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

      <div className="space-y-4">
        {/* Overall Rating */}
        <div>
          <StarRating
            label="Overall Rating:"
            value={overallRating}
            onChange={setOverallRating}
            size="lg"
            showValue={false}
          />
          <p className="text-xs text-gray-500 mt-2">
            How would you rate this scene overall?
          </p>
        </div>

        {/* Optional Feedback */}
        <div>
          <label className="text-xs font-medium text-gray-700 block mb-1">
            Additional Feedback (Optional)
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What could be improved?"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={2}
            maxLength={500}
          />
          <p className="text-xs text-gray-400 mt-1">
            {feedback.length}/500 characters
          </p>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSave}
          disabled={!canSubmit || isSaving}
          className={`
            w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors
            ${canSubmit && !isSaving
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
        >
          {isSaving ? 'Saving...' : hasRating ? 'Update Rating' : 'Submit Rating'}
        </button>

        {!canSubmit && (
          <p className="text-xs text-red-500 text-center">
            Please provide a rating before submitting
          </p>
        )}
      </div>
    </div>
  );
}
