/**
 * Dashboard home page
 * Guided flow layout: Primary CTA → Workflow steps → Demo videos → Secondary features
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import VideoCarousel from '@/components/landing/VideoCarousel';
import type { YouTubeVideo } from '@/app/api/v1/youtube/playlist/route';

const DEMO_PLAYLIST_ID = 'PLyDpAVbXE4SWPWFFiQUdo8FyMAhi90fA5';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [demoVideos, setDemoVideos] = useState<YouTubeVideo[]>([]);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const loadUser = async () => {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const isSupabaseConfigured = supabaseUrl && !supabaseUrl.includes('your-project-id');

      if (isSupabaseConfigured) {
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

  // Fetch demo videos
  useEffect(() => {
    const fetchDemoVideos = async () => {
      try {
        const res = await fetch(`/api/v1/youtube/playlist?playlistId=${DEMO_PLAYLIST_ID}`);
        const data = await res.json();
        if (data.success && data.videos) {
          setDemoVideos(data.videos);
        }
      } catch (error) {
        console.error('Failed to fetch demo videos:', error);
      }
    };

    fetchDemoVideos();
  }, []);

  // Fetch draft count
  useEffect(() => {
    if (!user) return;

    const fetchDraftCount = async () => {
      try {
        const supabase = createClient();
        const { count } = await supabase
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'draft');
        setDraftCount(count || 0);
      } catch (error) {
        console.error('Failed to fetch draft count:', error);
      }
    };

    fetchDraftCount();
  }, [user]);

  const handleCreateStoryClick = async () => {
    try {
      const response = await fetch('/api/usage/limits');
      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to check limits:', data);
        router.push('/create');
        return;
      }

      if (!data.canCreate) {
        router.push('/limit-reached');
        return;
      }

      router.push('/create');
    } catch (error) {
      console.error('Error checking limits:', error);
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
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Section 1: Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back{user.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            Follow the steps below to create your story.
          </p>
        </div>

        {/* Section 2: Your Story Journey */}
        <div className="mb-10">
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-5">
            Your Story Journey
          </h3>

          {/* Desktop: horizontal stepper */}
          <div className="hidden md:block">
            {/* Step indicators + connecting line */}
            <div className="relative flex items-center justify-between mb-6 px-[60px]">
              {/* Connecting line behind the circles */}
              <div className="absolute left-[60px] right-[60px] top-1/2 -translate-y-1/2 h-0.5 bg-blue-200" />
              {/* Arrow on the line (between step 1 and 2) */}
              <div className="absolute left-[calc(33%-8px)] top-1/2 -translate-y-1/2 z-10">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              {/* Arrow on the line (between step 2 and 3) */}
              <div className="absolute left-[calc(66%-8px)] top-1/2 -translate-y-1/2 z-10">
                <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
              {/* Step circles */}
              {[1, 2, 3].map((step) => (
                <div key={step} className="relative z-20 flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white font-bold text-sm shadow-md">
                  {step}
                </div>
              ))}
            </div>

            {/* Cards below the stepper */}
            <div className="grid grid-cols-3 gap-5">
              <Link
                href="/characters"
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <h4 className="font-semibold text-gray-900 mb-1">Characters</h4>
                <p className="text-sm text-gray-500">
                  Create your characters first
                </p>
                <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                  Manage Characters
                </p>
              </Link>

              <button
                onClick={handleCreateStoryClick}
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all group text-left"
              >
                <h4 className="font-semibold text-gray-900 mb-1">Create Story</h4>
                <p className="text-sm text-gray-500">
                  Write and illustrate your story
                </p>
                <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                  Start Writing
                </p>
              </button>

              <Link
                href="/projects"
                className="bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900">My Stories</h4>
                  {draftCount > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  View all your storybooks
                </p>
                <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                  View Stories
                </p>
              </Link>
            </div>
          </div>

          {/* Mobile: vertical stepper */}
          <div className="md:hidden space-y-0">
            {[
              { step: 1, title: 'Characters', desc: 'Create your characters first', link: '/characters', cta: 'Manage Characters' },
              { step: 2, title: 'Create Story', desc: 'Write and illustrate your story', link: null, cta: 'Start Writing' },
              { step: 3, title: 'My Stories', desc: 'View all your storybooks', link: '/projects', cta: 'View Stories' },
            ].map((item, idx) => (
              <div key={item.step} className="flex gap-4">
                {/* Vertical line + circle */}
                <div className="flex flex-col items-center">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-sm shadow-md flex-shrink-0">
                    {item.step}
                  </div>
                  {idx < 2 && (
                    <div className="w-0.5 h-6 bg-blue-200 my-1" />
                  )}
                </div>
                {/* Card */}
                {item.link ? (
                  <Link
                    href={item.link}
                    className="flex-1 bg-white border border-gray-200 rounded-xl p-4 mb-3 hover:border-blue-400 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{item.title}</h4>
                      {item.step === 3 && draftCount > 0 && (
                        <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                    <p className="text-sm text-blue-600 font-medium mt-2 group-hover:underline">{item.cta}</p>
                  </Link>
                ) : (
                  <button
                    onClick={handleCreateStoryClick}
                    className="flex-1 bg-white border border-gray-200 rounded-xl p-4 mb-3 hover:border-blue-400 hover:shadow-md transition-all group text-left"
                  >
                    <h4 className="font-semibold text-gray-900">{item.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
                    <p className="text-sm text-blue-600 font-medium mt-2 group-hover:underline">{item.cta}</p>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section 4: Demo Videos */}
        {demoVideos.length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
              Need Help? Watch How It Works
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <VideoCarousel videos={demoVideos} />
            </div>
          </div>
        )}

        {/* Section 5: More to Explore */}
        <div>
          <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4">
            More to Explore
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/photos"
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <h4 className="font-semibold text-gray-900">Photos to Storybook</h4>
              <p className="text-sm text-gray-500 mt-1">
                Turn family photos into illustrated stories
              </p>
              <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                Upload Photos
              </p>
            </Link>

            <Link
              href="/import"
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <h4 className="font-semibold text-gray-900">Import PDF</h4>
              <p className="text-sm text-gray-500 mt-1">
                Bring any PDF storybook to life with narration
              </p>
              <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                Import PDF
              </p>
            </Link>

            <Link
              href="/community-stories"
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-gray-300 hover:shadow-sm transition-all group"
            >
              <h4 className="font-semibold text-gray-900">Community Stories</h4>
              <p className="text-sm text-gray-500 mt-1">
                Discover inspiring tales shared by other families
              </p>
              <p className="text-sm text-blue-600 font-medium mt-3 group-hover:underline">
                Browse Stories
              </p>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
