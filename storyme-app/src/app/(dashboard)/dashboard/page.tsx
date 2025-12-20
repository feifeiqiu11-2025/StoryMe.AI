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

  const handleCreateStoryClick = async () => {
    // Check story creation limits before allowing navigation
    try {
      const response = await fetch('/api/usage/limits');
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to check limits:', data);
        // If check fails, allow navigation (fail open)
        router.push('/create');
        return;
      }

      // Check if user can create stories
      if (!data.canCreate) {
        // Redirect to limit-reached transition page
        router.push('/limit-reached');
        return;
      }

      // User can create, navigate to create page
      router.push('/create');
    } catch (error) {
      console.error('Error checking limits:', error);
      // On error, allow navigation (fail open)
      router.push('/create');
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

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-5xl">👋</div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Welcome back{user.name ? `, ${user.name}` : ''}!
              </h1>
              <p className="text-gray-600 text-lg mt-1">
                Ready to create magical stories today?
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
          {/* Create Story */}
          <button
            onClick={handleCreateStoryClick}
            className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1 group border-2 border-blue-200 hover:border-blue-300 text-left"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-md">
              ✨
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Create Story</h3>
            <p className="text-gray-700 text-sm mb-4">
              Start a new personalized storybook with AI illustrations
            </p>
            <div className="flex items-center gap-2 text-blue-600 font-semibold group-hover:gap-3 transition-all text-sm">
              Start Creating →
            </div>
          </button>

          {/* Character Library */}
          <Link
            href="/characters"
            className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1 group border-2 border-purple-200 hover:border-purple-300"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-md">
              👦👧
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Characters</h3>
            <p className="text-gray-700 text-sm mb-4">
              Manage your character library for reuse
            </p>
            <div className="flex items-center gap-2 text-purple-600 font-semibold group-hover:gap-3 transition-all text-sm">
              Manage Characters →
            </div>
          </Link>

          {/* Import PDF */}
          <Link
            href="/import"
            className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1 group border-2 border-teal-200 hover:border-teal-300"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-md">
              📄
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Import PDF</h3>
            <p className="text-gray-700 text-sm mb-4">
              Convert PDF storybooks to interactive stories with audio
            </p>
            <div className="flex items-center gap-2 text-teal-600 font-semibold group-hover:gap-3 transition-all text-sm">
              Import PDF →
            </div>
          </Link>
        </div>

        {/* Quick Actions Grid - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* My Stories */}
          <Link
            href="/projects"
            className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1 group border-2 border-indigo-200 hover:border-indigo-300"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-md">
              📚
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">My Stories</h3>
            <p className="text-gray-700 text-sm mb-4">
              Browse and manage all your storybooks
            </p>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold group-hover:gap-3 transition-all text-sm">
              View Stories →
            </div>
          </Link>

          {/* Community Gallery */}
          <Link
            href="/community-stories"
            className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all transform hover:-translate-y-1 group border-2 border-pink-200 hover:border-pink-300"
          >
            <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform shadow-md">
              🌟
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Community Stories</h3>
            <p className="text-gray-700 text-sm mb-4">
              Explore stories from our community
            </p>
            <div className="flex items-center gap-2 text-pink-600 font-semibold group-hover:gap-3 transition-all text-sm">
              Browse Stories →
            </div>
          </Link>
        </div>

        {/* Sample Storybooks Gallery */}
        {sampleStorybooks.length > 0 && (
          <div className="mb-8">
            <div className="mb-6 bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
                    <span className="text-4xl">✨</span>
                    <span>Sample Storybooks</span>
                  </h2>
                  <p className="text-gray-600">
                    Get inspired by these example storybooks from our community
                  </p>
                </div>
                <Link
                  href="/community-stories"
                  className="hidden md:flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl hover:from-pink-600 hover:to-purple-600 font-semibold shadow-lg transition-all"
                >
                  <span>View All</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampleStorybooks.map((storybook) => (
                <div
                  key={storybook.id}
                  className="bg-white rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all transform hover:-translate-y-2 border border-gray-200 hover:border-purple-300"
                >
                  {/* Cover Image */}
                  <div className="relative h-64 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 overflow-hidden group">
                    <Image
                      src={storybook.coverImage}
                      alt={storybook.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-xl font-bold text-gray-900 flex-1 line-clamp-2">
                        {storybook.title}
                      </h3>
                      <span className="text-xs bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700 px-3 py-1 rounded-full font-semibold ml-2 whitespace-nowrap">
                        {storybook.ageGroup}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-2">
                      {storybook.description}
                    </p>

                    {/* Characters */}
                    <div className="flex items-center gap-2 mb-4 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">Characters:</span>
                      {storybook.characters.slice(0, 3).map((character, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-medium"
                        >
                          {character}
                        </span>
                      ))}
                      {storybook.characters.length > 3 && (
                        <span className="text-xs text-gray-400">
                          +{storybook.characters.length - 3}
                        </span>
                      )}
                    </div>

                    {/* Scene Preview */}
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      {storybook.scenes.slice(0, 3).map((scene, idx) => (
                        <div
                          key={idx}
                          className="relative h-20 rounded-lg overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-200"
                        >
                          <Image
                            src={scene.imageUrl}
                            alt={`Scene ${idx + 1}`}
                            fill
                            className="object-cover hover:scale-110 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                        <span className="font-medium">{storybook.scenes.length} scenes</span>
                      </div>
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
      </div>
    </div>
  );
}
