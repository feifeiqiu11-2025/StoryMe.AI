/**
 * Admin index — navigation hub for admin sub-pages.
 * Pages are grouped into Insights / Operations / Tools.
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  LifeBuoy,
  GraduationCap,
  FileText,
  Image as ImageIcon,
  BookOpen,
  Building2,
  Mail,
  Inbox,
  Presentation,
  Handshake,
  ArrowUpRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

interface AdminPage {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
  external?: boolean; // open in a new tab (e.g. static pages served outside the app router)
}

interface AdminGroup {
  title: string;
  pages: AdminPage[];
}

const groups: AdminGroup[] = [
  {
    title: 'Insights',
    pages: [
      {
        title: 'Metrics',
        description: 'Users, stories, and tier breakdowns.',
        href: '/admin/metrics',
        icon: <BarChart3 className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Support tickets',
        description: 'Demo requests and support inquiries.',
        href: '/admin/support',
        icon: <LifeBuoy className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Leads',
        description: 'Inbound contact submissions from /contact.',
        href: '/admin/leads',
        icon: <Inbox className="w-[18px] h-[18px]" />,
      },
    ],
  },
  {
    title: 'Operations',
    pages: [
      {
        title: 'Workshops',
        description: 'Events, sessions, registrations.',
        href: '/admin/workshops',
        icon: <GraduationCap className="w-[18px] h-[18px]" />,
      },
      {
        title: 'School bundles',
        description: 'Four-teacher teams on shared billing.',
        href: '/admin/school-bundles',
        icon: <Building2 className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Marketing email',
        description: 'Story-format broadcasts — Spark letters.',
        href: '/admin/marketing-email',
        icon: <Mail className="w-[18px] h-[18px]" />,
      },
    ],
  },
  {
    title: 'Tools',
    pages: [
      {
        title: 'PDF back cover',
        description: 'Back-cover templates for printable books.',
        href: '/admin/pdf-back-cover',
        icon: <FileText className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Poster generator',
        description: 'Promotional posters for campaigns.',
        href: '/admin/poster',
        icon: <ImageIcon className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Teacher training',
        description: 'Classroom walkthroughs for schools.',
        href: '/admin/training',
        icon: <BookOpen className="w-[18px] h-[18px]" />,
      },
      {
        title: 'Investor deck',
        description: 'KindleWood pitch deck — public link at /pitch.',
        href: '/pitch',
        icon: <Presentation className="w-[18px] h-[18px]" />,
        external: true,
      },
      {
        title: 'Partnership deck',
        description: 'KindleWood × STEAMOJI proposal — public link at /partnership.',
        href: '/partnership',
        icon: <Handshake className="w-[18px] h-[18px]" />,
        external: true,
      },
    ],
  },
];

export default function AdminIndexPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <header className="mb-10">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-[0.14em]">
          KindleWood Studio
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">Admin</h1>
      </header>

      <div className="space-y-10">
        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="text-xs font-medium text-gray-500 uppercase tracking-[0.12em] mb-3">
              {group.title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.pages.map((page) => (
                <AdminCard key={page.href} page={page} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AdminCard({ page }: { page: AdminPage }) {
  const className =
    'group relative bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 hover:bg-gray-50/40 transition-colors';
  const inner = (
    <div className="flex items-start gap-3">
      <div className="text-gray-700 mt-[3px] flex-shrink-0">{page.icon}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900">{page.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{page.description}</p>
      </div>
      <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-gray-600 transition-colors flex-shrink-0" />
    </div>
  );

  // Static pages served outside the app router (e.g. /admin/pitch) open in a new tab.
  if (page.external) {
    return (
      <a href={page.href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link href={page.href} className={className}>
      {inner}
    </Link>
  );
}
