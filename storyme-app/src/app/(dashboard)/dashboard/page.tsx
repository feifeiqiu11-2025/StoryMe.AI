/**
 * Dashboard home page
 * Shows overview and quick start for story creation
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { sampleStorybooks } from '@/data/sample-storybooks';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      // Check if Supabase is configured
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
        // Use real Supabase authentication
        const supabase = createClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (supabaseUser) {
          setUser({
            id: supabaseUser.id,
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0],
          });
        } else {
          router.push('/login');
        }
      } else {
        // Fallback to local session
        const sessionData = localStorage.getItem('storyme_session');
        if (sessionData) {
          const session = JSON.parse(sessionData);
          if (new Date(session.expires_at) > new Date()) {
            setUser(session.user);
          } else {
            localStorage.removeItem('storyme_session');
            router.push('/login');
          }
        } else {
          router.push('/login');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [router]);

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

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with Logout */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Welcome back{user.name ? `, ${user.name}` : ''}!
            </h1>
            <p className="mt-2 text-gray-600">
              Create personalized children's storybooks with AI
            </p>
          </div>
          <button
            onClick={async () => {
              // Check if Supabase is configured
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
              const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

              if (isSupabaseConfigured) {
                // Use real Supabase sign out
                const supabase = createClient();
                await supabase.auth.signOut();
              } else {
                // Fallback to local session
                localStorage.removeItem('storyme_session');
              }
              router.push('/');
            }}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
          >
            Sign Out
          </button>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Create Story */}
          <Link
            href="/create"
            className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 text-white group"
          >
            <div className="text-5xl mb-4">✨</div>
            <h3 className="text-2xl font-bold mb-2">Create Story</h3>
            <p className="text-blue-50 mb-4">
              Start a new personalized storybook with AI illustrations
            </p>
            <div className="flex items-center gap-2 text-white font-semibold group-hover:gap-3 transition-all">
              Start Creating →
            </div>
          </Link>

          {/* My Stories */}
          <Link
            href="/projects"
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 group"
          >
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">My Stories</h3>
            <p className="text-gray-600 mb-4">
              Browse and manage all your storybooks
            </p>
            <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all">
              View Stories →
            </div>
          </Link>

          {/* Character Library */}
          <Link
            href="/characters"
            className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-1 group"
          >
            <div className="text-5xl mb-4">👦👧</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Characters</h3>
            <p className="text-gray-600 mb-4">
              Manage your character library for reuse
            </p>
            <div className="flex items-center gap-2 text-purple-600 font-semibold group-hover:gap-3 transition-all">
              Manage Characters →
            </div>
          </Link>
        </div>

        {/* Sample Storybooks Gallery */}
        {sampleStorybooks.length > 0 && (
          <div className="mb-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                <span className="text-3xl">📚</span>
                <span>Sample Storybooks</span>
              </h2>
              <p className="text-gray-600">
                Get inspired by these example storybooks
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampleStorybooks.map((storybook) => (
                <div
                  key={storybook.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-1 border-2 border-gray-100"
                >
                  {/* Cover Image */}
                  <div className="relative h-64 bg-gradient-to-br from-blue-50 to-purple-50">
                    <Image
                      src={storybook.coverImage}
                      alt={storybook.title}
                      fill
                      className="object-cover"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900 flex-1">
                        {storybook.title}
                      </h3>
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium ml-2">
                        {storybook.ageGroup}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                      {storybook.description}
                    </p>

                    {/* Characters */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="text-xs text-gray-500">Characters:</span>
                      {storybook.characters.map((character, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                        >
                          {character}
                        </span>
                      ))}
                    </div>

                    {/* Scene Preview */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {storybook.scenes.slice(0, 3).map((scene, idx) => (
                        <div
                          key={idx}
                          className="relative h-20 rounded-lg overflow-hidden bg-gray-100"
                        >
                          <Image
                            src={scene.imageUrl}
                            alt={`Scene ${idx + 1}`}
                            fill
                            className="object-cover"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <span className="text-xs text-gray-500">
                        {storybook.scenes.length} scenes
                      </span>
                      {storybook.isCustomerSubmission && storybook.customerName && (
                        <span className="text-xs text-gray-500 italic">
                          by {storybook.customerName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-3">🎨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              AI-Generated Art
            </h3>
            <p className="text-gray-600 text-sm">
              Beautiful, consistent illustrations generated by AI for every scene
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-3">👦👧</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Your Characters
            </h3>
            <p className="text-gray-600 text-sm">
              Upload photos to create personalized characters that look like your kids
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-3">📖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Instant Storybooks
            </h3>
            <p className="text-gray-600 text-sm">
              Type your story, and we'll transform it into a beautiful storybook
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
