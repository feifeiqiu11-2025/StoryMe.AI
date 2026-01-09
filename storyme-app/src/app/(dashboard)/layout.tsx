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
            <div className="flex items-center">
              {/* Hamburger Menu */}
              <HamburgerMenu />

              {/* Logo */}
              <Link href="/dashboard" className="hover:opacity-80 transition-opacity mr-6">
                <img
                  src="/Logo_New.png"
                  alt="KindleWood Studio"
                  className="h-10 sm:h-12 w-auto"
                />
              </Link>

              {/* Navigation */}
              <DashboardNav />
            </div>
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
