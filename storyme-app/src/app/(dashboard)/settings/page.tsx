/**
 * Account Settings Page
 * Manage account, profile, password, and subscription
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Messages
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscription info
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();

      if (!supabaseUser) {
        router.push('/login');
        return;
      }

      setUser(supabaseUser);
      setName(supabaseUser.user_metadata?.name || '');
      setEmail(supabaseUser.email || '');

      // Load subscription info from users table
      const { data: userData } = await supabase
        .from('users')
        .select('subscription_tier')
        .eq('id', supabaseUser.id)
        .single();

      if (userData) {
        setSubscriptionTier(userData.subscription_tier || 'free');
      }

      setLoading(false);
    };

    loadUser();
  }, [router]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setProfileMessage(null);

    try {
      const supabase = createClient();

      // Update user metadata
      const { error } = await supabase.auth.updateUser({
        data: { name },
      });

      if (error) {
        setProfileMessage({ type: 'error', text: error.message });
        setSaving(false);
        return;
      }

      // Update users table
      await supabase
        .from('users')
        .update({ name })
        .eq('id', user.id);

      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err) {
      console.error('Profile update error:', err);
      setProfileMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setPasswordMessage(null);

    // Validation
    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      setSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      setSaving(false);
      return;
    }

    try {
      const supabase = createClient();

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordMessage({ type: 'error', text: error.message });
        setSaving(false);
        return;
      }

      setPasswordMessage({ type: 'success', text: 'Password updated successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Password change error:', err);
      setPasswordMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteMessage({ type: 'error', text: 'Please type DELETE to confirm' });
      return;
    }

    setDeleting(true);
    setDeleteMessage(null);

    try {
      const supabase = createClient();

      // Call delete account API endpoint
      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json();
        setDeleteMessage({ type: 'error', text: data.error || 'Failed to delete account' });
        setDeleting(false);
        return;
      }

      // Sign out
      await supabase.auth.signOut();

      // Redirect to homepage
      router.push('/?deleted=true');
    } catch (err) {
      console.error('Delete account error:', err);
      setDeleteMessage({ type: 'error', text: 'An unexpected error occurred.' });
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">Manage your account, profile, and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>👤</span>
              <span>Profile Information</span>
            </h2>

            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-3 py-2 text-gray-500 bg-gray-100 border border-gray-300 rounded-lg cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              {profileMessage && (
                <div className={`text-sm ${profileMessage.type === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'} border rounded p-3`}>
                  {profileMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>

          {/* Subscription Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>💎</span>
              <span>Subscription</span>
            </h2>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700">
                  Current Plan: <strong className="text-lg capitalize">{subscriptionTier}</strong>
                </p>
                {subscriptionTier === 'free' && (
                  <p className="text-sm text-gray-500 mt-1">Upgrade to unlock unlimited features</p>
                )}
              </div>
              <Link
                href="/upgrade"
                className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700"
              >
                Manage Subscription
              </Link>
            </div>
          </div>

          {/* Password Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔒</span>
              <span>Change Password</span>
            </h2>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  minLength={6}
                />
                <p className="text-xs text-gray-500 mt-1">At least 6 characters</p>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              {passwordMessage && (
                <div className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'} border rounded p-3`}>
                  {passwordMessage.text}
                </div>
              )}

              <button
                type="submit"
                disabled={saving || !newPassword || !confirmPassword}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>

          {/* Delete Account Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-red-200">
            <h2 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <span>Danger Zone</span>
            </h2>

            {!showDeleteConfirm ? (
              <div>
                <p className="text-gray-700 mb-4">
                  Once you delete your account, there is no going back. All your stories, characters, and data will be permanently deleted.
                </p>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700"
                >
                  Delete Account
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-semibold mb-2">⚠️ This action cannot be undone!</p>
                  <p className="text-red-700 text-sm mb-2">
                    This will permanently delete:
                  </p>
                  <ul className="text-red-700 text-sm list-disc list-inside space-y-1">
                    <li>Your account and profile</li>
                    <li>All your stories and characters</li>
                    <li>All uploaded images and generated content</li>
                    <li>All child profiles and reading data</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type <strong>DELETE</strong> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    className="w-full px-3 py-2 text-gray-900 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                    placeholder="DELETE"
                  />
                </div>

                {deleteMessage && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
                    {deleteMessage.text}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting || deleteConfirmText !== 'DELETE'}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting ? 'Deleting...' : 'Permanently Delete Account'}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                      setDeleteMessage(null);
                    }}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8">
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
