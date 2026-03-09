/**
 * Admin Workshop Registrations Dashboard
 * /admin/workshops
 *
 * View all workshop sign-ups with payment status, session details, and revenue.
 * Restricted to hardcoded admin emails.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { WORKSHOP_PARTNERS } from '@/lib/workshops/constants';

const ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'panglu7373@gmail.com',
];

interface Registration {
  id: string;
  parent_first_name: string;
  parent_last_name: string;
  parent_email: string;
  parent_phone: string;
  child_first_name: string;
  child_last_name: string | null;
  child_age: number;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relation: string;
  partner_id: string;
  selected_session_type: 'morning' | 'afternoon';
  selected_workshop_ids: string[];
  payment_status: string;
  status: string;
  amount_paid: number | null;
  stripe_payment_intent_id: string | null;
  promo_code: string | null;
  created_at: string;
}

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-gray-100 text-gray-800',
};

const sessionTypeColors: Record<string, string> = {
  morning: 'bg-amber-100 text-amber-800',
  afternoon: 'bg-green-100 text-green-800',
};

export default function AdminWorkshopsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [sessionFilter, setSessionFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [weekFilter, setWeekFilter] = useState<'all' | string>('all');
  const [authorized, setAuthorized] = useState(false);

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      if (!ADMIN_EMAILS.includes(user.email || '')) {
        router.push('/dashboard');
        return;
      }

      setAuthorized(true);
    };
    checkAuth();
  }, [router]);

  // Load registrations
  useEffect(() => {
    if (!authorized) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/admin/workshop-registrations');
        if (!res.ok) throw new Error('Failed to fetch registrations');
        const json = await res.json();
        setRegistrations(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [authorized]);

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Checking access...</p>
      </div>
    );
  }

  // Get partner for week filter options
  const partner = WORKSHOP_PARTNERS.find((p) => !p.comingSoon);

  // Filter registrations (all 3 filters work together)
  const filtered = registrations.filter((r) => {
    if (filter === 'paid' && r.payment_status !== 'paid') return false;
    if (filter === 'pending' && r.payment_status !== 'pending') return false;
    if (sessionFilter !== 'all' && r.selected_session_type !== sessionFilter) return false;
    if (weekFilter !== 'all' && !r.selected_workshop_ids.includes(weekFilter)) return false;
    return true;
  });

  // Summary stats
  const totalRegistrations = registrations.length;
  const paidRegistrations = registrations.filter((r) => r.payment_status === 'paid');
  const pendingRegistrations = registrations.filter((r) => r.payment_status === 'pending');
  const totalRevenue = paidRegistrations.reduce((sum, r) => sum + (r.amount_paid || 0), 0);
  const morningCount = paidRegistrations.filter((r) => r.selected_session_type === 'morning').length;
  const afternoonCount = paidRegistrations.filter((r) => r.selected_session_type === 'afternoon').length;

  // Helper: get week labels for selected workshop IDs
  const getWeekLabels = (partnerIdVal: string, workshopIds: string[]) => {
    const partner = WORKSHOP_PARTNERS.find((p) => p.id === partnerIdVal);
    if (!partner) return workshopIds.join(', ');
    return workshopIds
      .map((id) => {
        const session = partner.sessions.find((s) => s.id === id);
        return session ? `Wk${partner.sessions.indexOf(session) + 1}` : id;
      })
      .join(', ');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Workshop Registrations</h1>
        <p className="text-gray-500 mt-1">View and track all workshop sign-ups</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalRegistrations}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
          <p className="text-sm text-green-600">Paid</p>
          <p className="text-2xl font-bold text-green-700">{paidRegistrations.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-yellow-200">
          <p className="text-sm text-yellow-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-700">{pendingRegistrations.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200">
          <p className="text-sm text-purple-600">Revenue</p>
          <p className="text-2xl font-bold text-purple-700">${(totalRevenue / 100).toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
          <p className="text-sm text-blue-600">AM / PM</p>
          <p className="text-2xl font-bold text-blue-700">{morningCount} / {afternoonCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        {/* Payment status */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Payment</span>
          {(['all', 'paid', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* Session type */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Session</span>
          {(['all', 'morning', 'afternoon'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setSessionFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                sessionFilter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f === 'all' ? 'All' : f === 'morning' ? 'AM' : 'PM'}
            </button>
          ))}
        </div>

        {/* Week */}
        {partner && partner.sessions.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Week</span>
            <button
              onClick={() => setWeekFilter('all')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                weekFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {partner.sessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setWeekFilter(s.id)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  weekFilter === s.id
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Wk{i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-400 mb-3">
        Showing {filtered.length} of {totalRegistrations} registrations
      </p>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading registrations...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No registrations found.</div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Parent</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Child</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Session</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Weeks</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {r.parent_first_name} {r.parent_last_name}
                      </div>
                      <div className="text-gray-500 text-xs">{r.parent_email}</div>
                      <div className="text-gray-400 text-xs">{r.parent_phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">
                        {r.child_first_name} {r.child_last_name || ''}
                      </div>
                      <div className="text-gray-500 text-xs">Age {r.child_age}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          sessionTypeColors[r.selected_session_type] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {r.selected_session_type === 'morning' ? 'AM (4-6)' : 'PM (7-9)'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {getWeekLabels(r.partner_id, r.selected_workshop_ids)}
                      <div className="text-gray-400 text-xs">
                        {r.selected_workshop_ids.length} session{r.selected_workshop_ids.length !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          paymentStatusColors[r.payment_status] || 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {r.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {r.amount_paid ? `$${(r.amount_paid / 100).toFixed(2)}` : '—'}
                      {r.promo_code && (
                        <div className="text-xs text-purple-600">{r.promo_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                      <br />
                      {new Date(r.created_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
