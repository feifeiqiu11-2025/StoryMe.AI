/**
 * Reset Link Expired Page
 * Shows when password reset link has expired or been used
 * Allows user to easily request a new link
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ResetLinkExpiredPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Resend error:', err);
      setError('Failed to send email. Please try again.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">New Reset Link Sent!</h2>
          <p className="text-gray-600 mb-6">
            We've sent a fresh password reset link to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Check your email and click the link to reset your password.
            <br />
            The link will expire in 1 hour.
          </p>
          <div className="space-y-3">
            <Link
              href="/login"
              className="block w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      {/* Icon and Title */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Reset Link Expired</h2>
        <p className="text-gray-600">
          This password reset link has expired or has already been used.
        </p>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">Why did this happen?</h3>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Password reset links expire after 1 hour for security</li>
          <li>Each link can only be used once</li>
          <li>Email preview may have consumed the link automatically</li>
        </ul>
      </div>

      {/* Request New Link Form */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Get a Fresh Reset Link</h3>
        <p className="text-sm text-gray-600 mb-4">
          Enter your email below and we'll send you a new password reset link.
        </p>

        <form onSubmit={handleResendEmail} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="you@example.com"
              autoFocus
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send New Reset Link'}
          </button>
        </form>
      </div>

      {/* Tips */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h4 className="font-medium text-gray-900 mb-2 text-sm">💡 Tips for next time:</h4>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Click the link within a few minutes of receiving it</li>
          <li>• Only click the link once (don't refresh the page)</li>
          <li>• Complete the password change in one session</li>
        </ul>
      </div>

      {/* Alternative Options */}
      <div className="text-center space-y-3">
        <Link
          href="/login"
          className="block text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Back to Sign In
        </Link>
        <p className="text-xs text-gray-500">
          Having trouble? Contact{' '}
          <a href="mailto:kindlewood@gmail.com" className="text-blue-600 hover:text-blue-700 underline">
            kindlewood@gmail.com
          </a>
        </p>
      </div>
    </div>
  );
}
