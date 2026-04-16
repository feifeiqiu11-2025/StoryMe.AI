/**
 * Admin Metrics Page
 * User registry, story leaderboard, and platform summary stats
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

interface UserRow {
  id: string;
  name: string;
  email: string;
  tier: string;
  status: string;
  trialStatus: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  storiesThisMonth: number;
  storiesLimit: number;
  createdAt: string;
}

interface LeaderboardRow {
  userId: string;
  name: string;
  email: string;
  totalStories: number;
  storiesThisMonth: number;
  tier: string;
}

interface Summary {
  totalUsers: number;
  totalProjects: number;
  tierCounts: Record<string, number>;
  statusCounts: Record<string, number>;
  activeTrials: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

const tierColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-700',
  trial: 'bg-gray-100 text-gray-700',
  basic: 'bg-blue-100 text-blue-700',
  premium: 'bg-purple-100 text-purple-700',
  team: 'bg-green-100 text-green-700',
  unknown: 'bg-gray-100 text-gray-500',
};

const tierLabels: Record<string, string> = {
  free: 'Trial',
  trial: 'Trial',
  basic: 'Casual',
  premium: 'Pro',
  team: 'School',
  unknown: '—',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminMetricsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 50, total: 0, totalPages: 0 });
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) { router.push('/login'); return; }
      if (!isAdminEmail(user.email)) { router.push('/dashboard'); return; }

      setAuthorized(true);
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (authorized) fetchMetrics(currentPage);
  }, [authorized, currentPage]);

  const fetchMetrics = async (page: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/metrics?page=${page}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      const data = await res.json();
      setUsers(data.users || []);
      setLeaderboard(data.leaderboard || []);
      setSummary(data.summary || null);
      setPagination(data.pagination || { page: 1, pageSize: 50, total: 0, totalPages: 0 });
    } catch (err) {
      console.error('Error fetching metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Platform Metrics</h1>
          <p className="text-gray-500 mt-1">User registry, story stats, and leaderboard</p>
        </div>
        <Link
          href="/admin"
          className="text-sm text-purple-600 hover:text-purple-700 font-medium"
        >
          &larr; Admin Home
        </Link>
      </div>

      {loading && !summary ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
                <div className="h-7 bg-gray-200 rounded w-14" />
              </div>
            ))}
          </div>
        </div>
      ) : summary && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <StatCard label="Total Users" value={summary.totalUsers} />
            <StatCard label="Total Stories" value={summary.totalProjects} />
            <StatCard label="Active Trials" value={summary.activeTrials} />
            <StatCard
              label="Casual (Basic)"
              value={summary.tierCounts['basic'] || 0}
            />
            <StatCard
              label="Pro (Premium)"
              value={summary.tierCounts['premium'] || 0}
            />
            <StatCard
              label="Schools (Team)"
              value={summary.tierCounts['team'] || 0}
            />
          </div>

          {/* Story Leaderboard */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Story Leaderboard</h2>
              <p className="text-sm text-gray-500">Top 20 users by total completed stories</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 font-medium text-gray-600 w-10">#</th>
                    <th className="px-5 py-3 font-medium text-gray-600">User</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Email</th>
                    <th className="px-5 py-3 font-medium text-gray-600 text-right">Total Stories</th>
                    <th className="px-5 py-3 font-medium text-gray-600 text-right">This Month</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leaderboard.map((row, idx) => (
                    <tr key={row.userId} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-400 font-medium">{idx + 1}</td>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{row.email}</td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{row.totalStories}</td>
                      <td className="px-5 py-3 text-right text-gray-600">{row.storiesThisMonth}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[row.tier] || tierColors.unknown}`}>
                          {tierLabels[row.tier] || row.tier}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-400">No stories created yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Registry */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">User Registry</h2>
                <p className="text-sm text-gray-500">
                  {pagination.total} users total — page {pagination.page} of {pagination.totalPages}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="px-5 py-3 font-medium text-gray-600">Name</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Email</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Signed Up</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Plan</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Status</th>
                    <th className="px-5 py-3 font-medium text-gray-600">Trial</th>
                    <th className="px-5 py-3 font-medium text-gray-600 text-right">Stories/mo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{u.name || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{u.email}</td>
                      <td className="px-5 py-3 text-gray-600">{formatDate(u.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${tierColors[u.tier] || tierColors.unknown}`}>
                          {tierLabels[u.tier] || u.tier}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${
                          u.status === 'active' ? 'text-green-600'
                            : u.status === 'trialing' ? 'text-blue-600'
                            : u.status === 'cancelled' ? 'text-red-500'
                            : 'text-gray-500'
                        }`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {u.trialStatus === 'active' ? (
                          <span className="text-blue-600 font-medium">
                            Active{u.trialEndsAt ? ` (ends ${formatDate(u.trialEndsAt)})` : ''}
                          </span>
                        ) : u.trialStatus === 'completed' ? (
                          <span className="text-gray-400">Completed</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-600">
                        {u.storiesThisMonth}/{u.storiesLimit > 0 ? u.storiesLimit : '—'}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-gray-400">No users found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Showing {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                    let pageNum: number;
                    if (pagination.totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= pagination.totalPages - 3) {
                      pageNum = pagination.totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`min-w-[36px] px-2 py-1.5 text-sm rounded-lg font-medium ${
                          pageNum === currentPage
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
