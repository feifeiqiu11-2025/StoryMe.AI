/**
 * Login page
 * Allows users to sign in with OAuth or email/password
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');

  // Check for redirect parameter in URL
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    const plan = searchParams.get('plan');
    const cycle = searchParams.get('cycle');

    if (redirect) {
      // Reconstruct the full redirect URL with all parameters
      let fullRedirect = redirect;
      if (plan) {
        fullRedirect += `?plan=${plan}`;
        if (cycle) {
          fullRedirect += `&cycle=${cycle}`;
        }
      }
      setRedirectPath(fullRedirect);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        // Use real Supabase authentication
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setError(error.message);
          setLoading(false);
          return;
        }

        // Ensure user record exists in users table (for existing users who signed up before this fix)
        if (data.user) {
          const { error: userError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              email: data.user.email,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
              subscription_tier: 'free'
            }]);

          // Ignore duplicate key errors (user already exists - expected)
          if (userError && userError.code !== '23505') {
            console.error('Error creating user record:', userError);
          }
        }
      } else {
        // Temporary local auth (for development without Supabase)
        const existingUsers = JSON.parse(localStorage.getItem('storyme_users') || '[]');
        const user = existingUsers.find((u: any) => u.email === email);

        if (!user) {
          setError('No account found with this email');
          setLoading(false);
          return;
        }

        // In local mode, we don't actually verify password (for simplicity)
        // Create session
        localStorage.setItem('storyme_session', JSON.stringify({
          user,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        }));

        console.log('Local auth successful, session created:', user);
      }

      // Use window.location for more reliable redirect
      console.log('Redirecting to:', redirectPath);
      window.location.href = redirectPath;
    } catch (err) {
      console.error('Login error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Sign In</h2>

      {/* OAuth Buttons (Primary) */}
      <SocialLoginButtons mode="signin" redirectTo={redirectPath} />

      {/* Email/Password Form (Secondary - Always Visible) */}
      <form onSubmit={handleLogin} className="space-y-4 mt-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700">
              Forgot?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
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
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Don't have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
