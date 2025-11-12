/**
 * Auth Code Error Page
 * Displayed when OAuth authentication fails
 */

'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function AuthCodeErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const errorCode = searchParams.get('error_code');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Error</h1>
          <p className="text-gray-600">We couldn't complete your sign-in</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-red-900 mb-2">Error Details:</h3>
            <div className="space-y-1 text-sm text-red-700">
              {error && <p><strong>Error:</strong> {error}</p>}
              {errorCode && <p><strong>Code:</strong> {errorCode}</p>}
              {errorDescription && (
                <p><strong>Description:</strong> {decodeURIComponent(errorDescription)}</p>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">What to try:</h3>
            <ul className="text-sm text-blue-700 space-y-2">
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Make sure you allow access when prompted by the sign-in provider</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Try using a different sign-in method (Google, Apple, or Email)</span>
              </li>
              <li className="flex items-start gap-2">
                <span>•</span>
                <span>Clear your browser cookies and try again</span>
              </li>
            </ul>
          </div>

          <Link
            href="/login"
            className="block w-full bg-blue-600 text-white text-center py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Back to Sign In
          </Link>

          <Link
            href="/"
            className="block w-full text-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            Go to Home
          </Link>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium">Debug Info (Development Only)</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(
                  {
                    error,
                    errorCode,
                    errorDescription,
                    url: window.location.href,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCodeErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <AuthCodeErrorContent />
    </Suspense>
  );
}
