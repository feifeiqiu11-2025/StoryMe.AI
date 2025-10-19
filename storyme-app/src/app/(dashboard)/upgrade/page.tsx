/**
 * Upgrade to Premium Page
 * Coming Soon placeholder
 */

import Link from 'next/link';

export default function UpgradePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">✨</span>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Premium Plans
            </h1>
            <p className="text-lg text-gray-600">
              Coming Soon!
            </p>
          </div>

          {/* Description */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
            <p className="text-sm text-gray-700">
              We're working on exciting premium features including unlimited image generation,
              priority support, and exclusive story templates.
            </p>
          </div>

          {/* Preview Features */}
          <div className="text-left space-y-3 pt-4">
            <div className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm text-gray-600">Unlimited image generation</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm text-gray-600">Priority processing</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm text-gray-600">Exclusive story templates</span>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-green-500 mt-0.5">✓</span>
              <span className="text-sm text-gray-600">Advanced customization options</span>
            </div>
          </div>

          {/* Back Button */}
          <Link
            href="/dashboard"
            className="inline-block w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-md"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
