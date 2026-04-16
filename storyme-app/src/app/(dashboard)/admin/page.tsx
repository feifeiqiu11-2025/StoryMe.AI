/**
 * Admin Index Page
 * Navigation hub for all admin sub-pages
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

const adminPages = [
  {
    title: 'Metrics',
    description: 'User registrations, story stats, and leaderboard',
    href: '/admin/metrics',
    icon: '📊',
    color: 'from-blue-500 to-indigo-500',
  },
  {
    title: 'Support Tickets',
    description: 'View and manage support requests and demo inquiries',
    href: '/admin/support',
    icon: '🎫',
    color: 'from-purple-500 to-pink-500',
  },
  {
    title: 'Workshops',
    description: 'Manage workshop events and registrations',
    href: '/admin/workshops',
    icon: '🎓',
    color: 'from-green-500 to-teal-500',
  },
  {
    title: 'PDF Back Cover',
    description: 'Customize PDF back cover templates',
    href: '/admin/pdf-back-cover',
    icon: '📄',
    color: 'from-orange-500 to-red-500',
  },
  {
    title: 'Poster',
    description: 'Generate promotional posters',
    href: '/admin/poster',
    icon: '🖼️',
    color: 'from-cyan-500 to-blue-500',
  },
];

export default function AdminIndexPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      if (!isAdminEmail(user.email)) {
        router.push('/dashboard');
        return;
      }

      setAuthorized(true);
    };
    checkAuth();
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage your KindleWood Studio platform</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {adminPages.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            className="bg-white rounded-xl shadow-md p-5 hover:shadow-lg transition-all hover:-translate-y-0.5 border border-gray-100"
          >
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-r ${page.color} text-white text-xl mb-3`}>
              {page.icon}
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">{page.title}</h3>
            <p className="text-sm text-gray-500">{page.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
