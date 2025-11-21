/**
 * Signup page
 * Allows new users to create an account with OAuth or email/password
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import PrivacyConsentModal from '@/components/auth/PrivacyConsentModal';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [redirectPath, setRedirectPath] = useState('/dashboard');
  const [pendingSignupData, setPendingSignupData] = useState<{
    email: string;
    password: string;
    name: string;
  } | null>(null);

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

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Store signup data and show consent modal
    setPendingSignupData({ email, password, name });
    setShowConsentModal(true);
  };

  const handleConsentGiven = async () => {
    if (!pendingSignupData) return;

    setLoading(true);

    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        // Use real Supabase authentication
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email: pendingSignupData.email,
          password: pendingSignupData.password,
          options: {
            data: {
              name: pendingSignupData.name,
            },
          },
        });

        if (error) {
          setError(error.message);
          setLoading(false);
          setShowConsentModal(false);
          return;
        }

        // Create user record in users table with consent
        if (data.user) {
          const trialStartDate = new Date();
          const trialEndDate = new Date(trialStartDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

          const { error: userError } = await supabase
            .from('users')
            .insert([{
              id: data.user.id,
              email: data.user.email,
              name: pendingSignupData.name,
              subscription_tier: 'free',
              trial_started_at: trialStartDate.toISOString(),
              trial_ends_at: trialEndDate.toISOString(),
              images_generated_count: 0,
              images_limit: 50,
              trial_status: 'active',
              privacy_consent_given: true,
              privacy_consent_date: new Date().toISOString(),
              privacy_consent_version: '1.0',
              terms_accepted: true,
              terms_accepted_date: new Date().toISOString(),
            }]);

          // Ignore duplicate key errors (user might already exist)
          if (userError && userError.code !== '23505') {
            console.error('Error creating user record:', userError);
          }
        }
      } else {
        // Temporary local auth (for development without Supabase)
        // Check if user already exists
        const existingUsers = JSON.parse(localStorage.getItem('storyme_users') || '[]');
        if (existingUsers.some((u: any) => u.email === email)) {
          setError('An account with this email already exists');
          setLoading(false);
          return;
        }

        // Create new user
        const newUser = {
          id: Date.now().toString(),
          email,
          name,
          created_at: new Date().toISOString(),
        };

        // Save user
        existingUsers.push(newUser);
        localStorage.setItem('storyme_users', JSON.stringify(existingUsers));

        // Create session
        localStorage.setItem('storyme_session', JSON.stringify({
          user: newUser,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        }));

        console.log('Local signup successful, session created:', newUser);
      }

      // Use window.location for more reliable redirect
      console.log('Redirecting to:', redirectPath);
      window.location.href = redirectPath;
    } catch (err) {
      console.error('Signup error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
      setShowConsentModal(false);
    }
  };

  const handleConsentDeclined = () => {
    setShowConsentModal(false);
    setPendingSignupData(null);
    setLoading(false);
  };

  return (
    <>
      <PrivacyConsentModal
        isOpen={showConsentModal}
        onConsent={handleConsentGiven}
        onDecline={handleConsentDeclined}
        loading={loading}
      />

      <div className="bg-white rounded-lg shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Account</h2>

      {/* OAuth Buttons (Primary) */}
      <SocialLoginButtons mode="signup" redirectTo={redirectPath} />

      {/* Email/Password Form (Secondary - Always Visible) */}
      <form onSubmit={handleSignup} className="space-y-4 mt-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="John Doe"
          />
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3 py-2 text-gray-900 placeholder:text-gray-400 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="••••••••"
          />
          <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
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

        {/* Trial Benefits Message */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎁</div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">Free 7-Day Trial Benefits:</p>
              <ul className="text-sm text-gray-700 space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>No credit card required</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Create up to 2 stories</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-600">✓</span>
                  <span>Full access to all features</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign In
          </Link>
        </p>
      </div>
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-lg shadow-xl p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
            <div className="h-10 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
