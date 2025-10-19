/**
 * Layout for dashboard pages
 * Provides navigation sidebar and header
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import Link from 'next/link';
import ProfileMenu from '@/components/ui/ProfileMenu';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user's display name
  const displayName = user.user_metadata?.name || user.email?.split('@')[0] || 'User';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-2xl font-bold hover:opacity-80 transition-opacity">
                📚 Story<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Me</span> ✨
              </Link>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">BETA</span>
            </div>
            <nav className="hidden md:flex space-x-6">
              <Link
                href="/dashboard"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/characters"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Characters
              </Link>
              <Link
                href="/projects"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                My Stories
              </Link>
              <Link
                href="/create"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Create Story
              </Link>
              <Link
                href="/community-stories"
                className="text-gray-700 hover:text-blue-600 px-3 py-2 text-sm font-medium transition-colors"
              >
                Community Stories
              </Link>
            </nav>
            <div className="flex items-center">
              <ProfileMenu displayName={displayName} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
