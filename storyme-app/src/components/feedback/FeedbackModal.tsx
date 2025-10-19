/**
 * Feedback Modal Component
 * Collects user feedback after first story save
 * Offers +5 bonus images as incentive
 */

'use client';

import { useState } from 'react';

interface FeedbackModalProps {
  isOpen: boolean;
  onSubmit: (data: { rating: number; feedbackText: string; isPublic: boolean; displayName: string }) => void;
  onSkip: () => void;
  loading?: boolean;
}

export default function FeedbackModal({
  isOpen,
  onSubmit,
  onSkip,
  loading = false,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [displayName, setDisplayName] = useState('');

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (rating === 0) {
      alert('Please select a star rating');
      return;
    }

    onSubmit({
      rating,
      feedbackText,
      isPublic,
      displayName: isPublic ? displayName : '',
    });
  };

  const stars = [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="text-4xl">🎉</div>
            <h2 className="text-2xl font-bold">You Created Your First Story!</h2>
          </div>
          <p className="text-blue-100 text-sm">
            Help us improve StoryMe and earn +5 bonus images!
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Bonus Incentive */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-300">
              <div className="flex items-center gap-3">
                <div className="text-3xl">🎁</div>
                <div>
                  <p className="font-bold text-gray-900">Get +5 Bonus Images!</p>
                  <p className="text-sm text-gray-700">
                    Share your feedback and we'll add 5 free images to your account
                  </p>
                </div>
              </div>
            </div>

            {/* Star Rating - Required */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                How was your experience? <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-2 items-center">
                {stars.map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    disabled={loading}
                    className="transition-transform hover:scale-110 focus:outline-none disabled:opacity-50"
                  >
                    <svg
                      className="w-12 h-12"
                      fill={(hoveredRating || rating) >= star ? '#FCD34D' : '#E5E7EB'}
                      stroke={(hoveredRating || rating) >= star ? '#F59E0B' : '#9CA3AF'}
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                ))}
                {rating > 0 && (
                  <span className="ml-2 text-sm font-medium text-gray-700">
                    {rating === 5 && '😍 Amazing!'}
                    {rating === 4 && '😊 Great!'}
                    {rating === 3 && '🙂 Good'}
                    {rating === 2 && '😐 Okay'}
                    {rating === 1 && '😞 Needs work'}
                  </span>
                )}
              </div>
            </div>

            {/* Text Feedback - Optional */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Tell us more (optional)
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value.slice(0, 500))}
                placeholder="What did you love? What could be better?"
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-500 mt-1">{feedbackText.length}/500 characters</p>
            </div>

            {/* Public Display Option */}
            {rating >= 4 && (
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    disabled={loading}
                    className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 mb-1">
                      Share as a testimonial on our website
                    </p>
                    <p className="text-sm text-gray-700">
                      Help other parents discover StoryMe! Your feedback may be featured on our landing page.
                    </p>
                  </div>
                </label>

                {/* Display Name Input - Shown when public is checked */}
                {isPublic && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      How should we display your name?
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value.slice(0, 100))}
                      placeholder="e.g., Sarah M."
                      disabled={loading}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                      maxLength={100}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      We recommend using first name + last initial (e.g., "Sarah M.")
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onSkip}
            disabled={loading}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || rating === 0}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {loading ? 'Submitting...' : 'Submit & Get +5 Images 🎁'}
          </button>
        </div>
      </div>
    </div>
  );
}
