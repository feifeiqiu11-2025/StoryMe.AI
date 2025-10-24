/**
 * Error Handler Component
 * Handles URL error parameters with Suspense boundary
 */

'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

function ErrorHandlerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const error = searchParams.get('error');
    const errorCode = searchParams.get('error_code');
    const errorDescription = searchParams.get('error_description');

    // Redirect expired password reset links to dedicated page
    if (errorCode === 'otp_expired' || (error === 'access_denied' && errorCode)) {
      router.push('/reset-link-expired');
      return;
    }

    if (error || errorCode) {
      setShowError(true);

      if (error === 'access_denied') {
        setErrorMessage('Access denied. Please try again.');
      } else {
        setErrorMessage(errorDescription || 'An authentication error occurred. Please try again.');
      }
    }
  }, [searchParams, router]);

  if (!showError) {
    return null;
  }

  return (
    <div className="bg-red-50 border-b-2 border-red-200">
      <div className="max-w-6xl mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Authentication Error</h3>
              <p className="text-sm text-red-700">{errorMessage}</p>
              <Link
                href="/forgot-password"
                className="text-sm text-red-800 underline hover:text-red-900 font-medium mt-2 inline-block"
              >
                Request a new password reset link →
              </Link>
            </div>
          </div>
          <button
            onClick={() => setShowError(false)}
            className="text-red-600 hover:text-red-800 flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ErrorHandler() {
  return (
    <ErrorHandlerInner />
  );
}
