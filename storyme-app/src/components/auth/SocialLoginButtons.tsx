/**
 * Social Login Buttons Component
 *
 * OAuth authentication buttons for Google, Microsoft, and Facebook
 * with traditional email/password option as secondary
 */

'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Provider } from '@supabase/supabase-js';

interface SocialLoginButtonsProps {
  mode: 'signin' | 'signup';
  redirectTo?: string; // Optional redirect after auth
}

export default function SocialLoginButtons({ mode, redirectTo }: SocialLoginButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string>('');

  const handleOAuthLogin = async (provider: Provider) => {
    setLoading(provider);
    setError('');

    try {
      const supabase = createClient();

      // Get base URL for redirect
      const baseUrl = window.location.origin;

      // Use the callback route to exchange code for session
      // The callback route will then redirect to the final destination
      const next = redirectTo || '/dashboard';
      const callbackUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(next)}`;

      console.log(`[${provider.toUpperCase()} OAuth] Initiating sign-in`, {
        provider,
        redirectTo: callbackUrl,
        next,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: callbackUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error(`[${provider.toUpperCase()} OAuth] Error from Supabase:`, {
          message: error.message,
          status: error.status,
          name: error.name,
          details: error,
        });
        throw error;
      }

      console.log(`[${provider.toUpperCase()} OAuth] Success, redirecting...`, data);

      // OAuth redirect happens automatically, no need to handle response
    } catch (err: any) {
      console.error(`[${provider.toUpperCase()} OAuth] Caught error:`, err);
      setError(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* OAuth Providers */}
      <div className="space-y-3">
        {/* Google (Primary) */}
        <button
          onClick={() => handleOAuthLogin('google')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading === 'google' ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
          )}
          <span className="font-medium">
            Continue with Google
          </span>
        </button>

        {/* Apple */}
        <button
          onClick={() => handleOAuthLogin('apple')}
          disabled={loading !== null}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {loading === 'apple' ? (
            <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
          )}
          <span className="font-medium">
            Continue with Apple
          </span>
        </button>

      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">or</span>
        </div>
      </div>

      {/* Email/Password Option - Always Visible */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          {mode === 'signin'
            ? 'Sign in with email and password'
            : 'Create account with email and password'}
        </p>
      </div>
    </div>
  );
}
