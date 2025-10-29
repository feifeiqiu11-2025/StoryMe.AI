'use client';

import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason: 'trial_expired' | 'story_limit_reached';
  storiesUsed?: number;
  storiesLimit?: number;
}

export default function UpgradeModal({
  isOpen,
  onClose,
  reason,
  storiesUsed = 0,
  storiesLimit = 5,
}: UpgradeModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    router.push('/upgrade');
  };

  const title = reason === 'trial_expired'
    ? 'Your Trial Has Ended'
    : 'Story Limit Reached';

  const message = reason === 'trial_expired'
    ? "Looks like your 7-day trial has ended. Upgrade to Basic or Premium to continue creating amazing personalized stories!"
    : `You've created ${storiesUsed} out of ${storiesLimit} free trial stories. Upgrade to get more stories every month or go unlimited with Premium!`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
            <span className="text-3xl">
              {reason === 'trial_expired' ? '⏰' : '📚'}
            </span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-3">
          {title}
        </h2>

        {/* Message */}
        <p className="text-gray-600 text-center mb-8">
          {message}
        </p>

        {/* Upgrade Benefits */}
        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Upgrade to unlock:</h3>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Basic:</strong> 20 stories per month for just $8.99</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span><strong>Premium:</strong> Unlimited stories + priority support</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>AI-powered personalized illustrations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 mt-0.5">✓</span>
              <span>Export to PDF for printing</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleUpgrade}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 font-semibold shadow-lg transition-all"
          >
            Upgrade Now
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
}
