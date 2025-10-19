/**
 * Privacy Consent Modal
 * Displays privacy notice and collects consent before account creation
 * Required for GDPR compliance and user transparency
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PrivacyConsentModalProps {
  isOpen: boolean;
  onConsent: () => void;
  onDecline: () => void;
  loading?: boolean;
}

export default function PrivacyConsentModal({
  isOpen,
  onConsent,
  onDecline,
  loading = false,
}: PrivacyConsentModalProps) {
  const [consentChecked, setConsentChecked] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">Privacy & Data Usage Notice</h2>
          <p className="text-blue-100 text-sm">
            Please review how we handle your data
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-6">
            {/* Photo Storage */}
            <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="text-3xl">📸</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-2">Your Photos Are Secure</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Photos are securely stored in our cloud database (Supabase)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>We never sell, share, or use your photos for any other purpose</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Only you can access your uploaded photos</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>You can delete your photos and account at any time</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* AI Image Generation */}
            <div className="bg-purple-50 rounded-lg p-4 border-2 border-purple-200">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🎨</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-2">AI Image Generation</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>We use fal.ai to generate personalized story illustrations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>Your photos are temporarily sent to fal.ai only for image generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>fal.ai does not permanently store your photos after generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>Generated images are saved to your private account</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Data Rights */}
            <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
              <div className="flex items-start gap-3">
                <div className="text-3xl">🔒</div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 mb-2">Your Rights</h3>
                  <ul className="text-sm text-gray-700 space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Access your data at any time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Delete your account and all data</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>Control story visibility (public/private)</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Consent Checkbox */}
            <div className="bg-gray-50 rounded-lg p-4 border-2 border-gray-300">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consentChecked}
                  onChange={(e) => setConsentChecked(e.target.checked)}
                  className="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <span className="text-sm text-gray-700 flex-1">
                  I understand and consent to StoryMe's data practices. I have read the{' '}
                  <Link
                    href="/privacy"
                    target="_blank"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link
                    href="/terms"
                    target="_blank"
                    className="text-blue-600 hover:text-blue-700 font-medium underline"
                  >
                    Terms of Service
                  </Link>
                  .
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3">
          <button
            onClick={onDecline}
            disabled={loading}
            className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Decline
          </button>
          <button
            onClick={onConsent}
            disabled={!consentChecked || loading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
          >
            {loading ? 'Creating Account...' : 'I Consent - Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
