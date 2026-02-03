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
                      <span>We use Google Gemini and OpenAI to generate personalized story illustrations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>Your photos are temporarily sent to AI services only for image generation</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-purple-600 mt-0.5">•</span>
                      <span>AI providers do not permanently store your photos after generation</span>
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

            {/* Consent Checkbox - Made more visible */}
            <div className="bg-white rounded-lg p-5 border-2 border-blue-300 shadow-sm">
              <label className="flex items-start gap-4 cursor-pointer group">
                <div className="flex-shrink-0 pt-0.5 relative inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(e) => setConsentChecked(e.target.checked)}
                    className="peer w-6 h-6 appearance-none bg-white border-2 border-gray-400 rounded cursor-pointer checked:bg-blue-600 checked:border-blue-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={loading}
                  />
                  <svg
                    className="absolute w-4 h-4 left-1 top-1 pointer-events-none hidden peer-checked:block text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="text-sm text-gray-800 flex-1 leading-relaxed">
                  <span className="font-semibold text-gray-900">Required:</span> I understand and consent to KindleWood Studio's data practices. I have read the{' '}
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
              {!consentChecked && (
                <div className="mt-3 ml-10 text-xs text-orange-600 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Please check the box above to continue
                </div>
              )}
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
