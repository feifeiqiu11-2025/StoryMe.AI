/**
 * Layout for dashboard pages
 * Provides navigation sidebar and header
 */

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ReactNode } from 'react';
import Link from 'next/link';
import ProfileMenu from '@/components/ui/ProfileMenu';
import EmailVerificationBanner from '@/components/auth/EmailVerificationBanner';
import HamburgerMenu from '@/components/navigation/HamburgerMenu';
import DashboardNav from '@/components/navigation/DashboardNav';

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
            <div className="flex items-center gap-3">
              {/* Hamburger Menu */}
              <HamburgerMenu />

              {/* Logo */}
              <Link href="/dashboard" className="text-xl sm:text-2xl font-bold hover:opacity-80 transition-opacity">
                📚 Kindle<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Wood</span> Studio ✨
              </Link>
              <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded-full">BETA</span>
            </div>
            <DashboardNav />
            <div className="flex items-center">
              <ProfileMenu displayName={displayName} />
            </div>
          </div>
        </div>
      </header>

      {/* Email Verification Banner */}
      <EmailVerificationBanner />

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
