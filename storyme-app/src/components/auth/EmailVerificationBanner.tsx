/**
 * Email Verification Banner
 * Displays a banner for users who haven't verified their email
 */

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function EmailVerificationBanner() {
  const [show, setShow] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkVerification = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user && !user.email_confirmed_at) {
        setShow(true);
      }
    };

    checkVerification();
  }, []);

  const handleResend = async () => {
    setResending(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        setMessage('No email found');
        setResending(false);
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage('Verification email sent! Check your inbox.');
      }
    } catch (err) {
      console.error('Resend error:', err);
      setMessage('Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  if (!show) {
    return null;
  }

  return (
    <div className="bg-yellow-50 border-b-2 border-yellow-200 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-yellow-600 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Please verify your email address
            </p>
            {message && (
              <p className={`text-xs ${message.includes('sent') ? 'text-green-600' : 'text-red-600'} mt-1`}>
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-sm text-yellow-700 hover:text-yellow-800 font-medium underline disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend Email'}
          </button>
          <button
            onClick={() => setShow(false)}
            className="text-yellow-600 hover:text-yellow-800"
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
