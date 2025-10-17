/**
 * Guest Signup Modal Component
 *
 * Modal that prompts guest users to create an account with OAuth options
 */

'use client';

import Link from 'next/link';
import SocialLoginButtons from './SocialLoginButtons';

interface GuestSignupModalProps {
  action: 'save' | 'download';
  onClose: () => void;
}

export default function GuestSignupModal({ action, onClose }: GuestSignupModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <div className="text-center">
          <div className="text-5xl mb-4">
            {action === 'save' ? '💾' : '📄'}
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            {action === 'save' ? 'Save Your Story' : 'Download as PDF'}
          </h3>
          <p className="text-gray-600 mb-6">
            {action === 'save'
              ? 'Create a free account to save your story and access it anytime from any device.'
              : 'Create a free account to download your storybook as a beautiful PDF.'}
          </p>

          {/* OAuth Buttons */}
          <div className="mb-4">
            <SocialLoginButtons mode="signup" redirectTo="/guest" />
          </div>

          {/* Traditional Signup Link */}
          <Link
            href="/signup"
            className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 font-semibold shadow-md hover:shadow-lg transition-all mb-3"
          >
            Create Free Account
          </Link>

          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 font-medium transition-all"
          >
            Maybe Later
          </button>

          <p className="text-xs text-gray-500 mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
