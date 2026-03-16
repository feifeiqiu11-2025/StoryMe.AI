/**
 * Admin Workshop Registrations Dashboard
 * /admin/workshops
 *
 * View all workshop sign-ups with payment status, session details, and revenue.
 * Supports multi-partner filtering with contextual Level 2 filters:
 *   - SteamOji: Payment + Session (AM/PM) + Week
 *   - Avocado:  Payment + Location (Bellevue/Kirkland) + Series
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
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  partner_id: string;
  selected_session_type: 'morning' | 'afternoon' | 'single';
  selected_workshop_ids: string[];
  location: string | null;
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

const partnerColors: Record<string, string> = {
  steamoji: 'bg-emerald-100 text-emerald-800',
  avocado: 'bg-amber-100 text-amber-800',
};

export default function AdminWorkshopsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  // Level 1: Partner filter
  const [partnerFilter, setPartnerFilter] = useState<'all' | string>('all');

  // Shared filter
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'paid' | 'pending'>('all');

  // SteamOji-specific filters
  const [sessionFilter, setSessionFilter] = useState<'all' | 'morning' | 'afternoon'>('all');
  const [weekFilter, setWeekFilter] = useState<'all' | string>('all');

  // Avocado-specific filters
  const [locationFilter, setLocationFilter] = useState<'all' | string>('all');
  const [seriesFilter, setSeriesFilter] = useState<'all' | number>('all');

  // Reset Level 2 filters when partner changes
  const handlePartnerChange = (partner: 'all' | string) => {
    setPartnerFilter(partner);
    setPaymentFilter('all');
    setSessionFilter('all');
    setWeekFilter('all');
    setLocationFilter('all');
    setSeriesFilter('all');
  };

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

  // Get active partners for filter buttons
  const activePartners = WORKSHOP_PARTNERS.filter((p) => !p.comingSoon);

  // Get selected partner config
  const selectedPartner = partnerFilter !== 'all'
    ? WORKSHOP_PARTNERS.find((p) => p.id === partnerFilter)
    : null;

  // Determine which series numbers exist for the selected partner
  const partnerSeriesNumbers = selectedPartner
    ? [...new Set(selectedPartner.sessions.map((s) => s.series).filter(Boolean))]
    : [];

  // Filter registrations
  const filtered = registrations.filter((r) => {
    // Level 1: Partner
    if (partnerFilter !== 'all' && r.partner_id !== partnerFilter) return false;

    // Shared: Payment
    if (paymentFilter === 'paid' && r.payment_status !== 'paid') return false;
    if (paymentFilter === 'pending' && r.payment_status !== 'pending') return false;

    // SteamOji-specific
    if (partnerFilter === 'steamoji' || (partnerFilter === 'all' && r.partner_id === 'steamoji')) {
      if (sessionFilter !== 'all' && r.partner_id === 'steamoji' && r.selected_session_type !== sessionFilter) return false;
      if (weekFilter !== 'all' && r.partner_id === 'steamoji' && !r.selected_workshop_ids.includes(weekFilter)) return false;
    }

    // Avocado-specific
    if (partnerFilter === 'avocado' || (partnerFilter === 'all' && r.partner_id === 'avocado')) {
      if (locationFilter !== 'all' && r.partner_id === 'avocado' && r.location !== locationFilter) return false;
      if (seriesFilter !== 'all' && r.partner_id === 'avocado') {
        const avocadoPartner = WORKSHOP_PARTNERS.find((p) => p.id === 'avocado');
        if (avocadoPartner) {
          const seriesSessions = avocadoPartner.sessions
            .filter((s) => s.series === seriesFilter)
            .map((s) => s.id);
          const hasSeriesSession = r.selected_workshop_ids.some((id) => seriesSessions.includes(id));
          if (!hasSeriesSession) return false;
        }
      }
    }

    return true;
  });

  // Summary stats (based on filtered results)
  const totalCount = filtered.length;
  const paidRegs = filtered.filter((r) => r.payment_status === 'paid');
  const pendingRegs = filtered.filter((r) => r.payment_status === 'pending');
  const totalRevenue = paidRegs.reduce((sum, r) => sum + (r.amount_paid || 0), 0);

  // 5th card: partner-specific breakdown
  const isSteamojiView = partnerFilter === 'steamoji';
  const isAvocadoView = partnerFilter === 'avocado';
  const morningCount = paidRegs.filter((r) => r.selected_session_type === 'morning').length;
  const afternoonCount = paidRegs.filter((r) => r.selected_session_type === 'afternoon').length;
  const bellevueCount = paidRegs.filter((r) => r.location === 'bellevue').length;
  const kirklandCount = paidRegs.filter((r) => r.location === 'kirkland').length;

  // Helper: get week labels for selected workshop IDs
  const getWeekLabels = (partnerIdVal: string, workshopIds: string[]) => {
    const p = WORKSHOP_PARTNERS.find((p) => p.id === partnerIdVal);
    if (!p) return workshopIds.join(', ');
    return workshopIds
      .map((id) => {
        const session = p.sessions.find((s) => s.id === id);
        return session ? `Wk${p.sessions.indexOf(session) + 1}` : id;
      })
      .join(', ');
  };

  // Helper: get session/location label for table
  const getSessionLabel = (r: Registration) => {
    if (r.partner_id === 'avocado') {
      if (r.location) {
        const avocadoPartner = WORKSHOP_PARTNERS.find((p) => p.id === 'avocado');
        const loc = avocadoPartner?.locations?.find((l) => l.slug === r.location);
        return loc?.name || r.location;
      }
      return 'Single';
    }
    return r.selected_session_type === 'morning' ? 'AM (4-6)' : 'PM (7-9)';
  };

  const getSessionBadgeColor = (r: Registration) => {
    if (r.partner_id === 'avocado') {
      if (r.location === 'bellevue') return 'bg-blue-100 text-blue-800';
      if (r.location === 'kirkland') return 'bg-purple-100 text-purple-800';
      return 'bg-gray-100 text-gray-800';
    }
    return r.selected_session_type === 'morning'
      ? 'bg-amber-100 text-amber-800'
      : 'bg-green-100 text-green-800';
  };

  // Filter pill helper
  const pillClass = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
      active
        ? 'bg-gray-900 text-white'
        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Workshop Registrations</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">Total</p>
          <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-green-200">
          <p className="text-sm text-green-600">Paid</p>
          <p className="text-2xl font-bold text-green-700">{paidRegs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-yellow-200">
          <p className="text-sm text-yellow-600">Pending</p>
          <p className="text-2xl font-bold text-yellow-700">{pendingRegs.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-200">
          <p className="text-sm text-purple-600">Revenue</p>
          <p className="text-2xl font-bold text-purple-700">${(totalRevenue / 100).toFixed(2)}</p>
        </div>
        {/* 5th card: partner-specific breakdown */}
        {isSteamojiView ? (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-600">AM / PM</p>
            <p className="text-2xl font-bold text-blue-700">{morningCount} / {afternoonCount}</p>
          </div>
        ) : isAvocadoView ? (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-600">Bellevue / Kirkland</p>
            <p className="text-2xl font-bold text-blue-700">{bellevueCount} / {kirklandCount}</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-200">
            <p className="text-sm text-blue-600">Partners</p>
            <p className="text-2xl font-bold text-blue-700">
              {activePartners.length}
            </p>
          </div>
        )}
      </div>

      {/* Level 1: Partner Filter */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Partner</span>
          <button
            onClick={() => handlePartnerChange('all')}
            className={pillClass(partnerFilter === 'all')}
          >
            All
          </button>
          {activePartners.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePartnerChange(p.id)}
              className={pillClass(partnerFilter === p.id)}
            >
              {p.id === 'steamoji' ? 'SteamOji' : p.id === 'avocado' ? 'Avocado' : p.partnerName}
            </button>
          ))}
        </div>
      </div>

      {/* Level 2: Contextual Filters */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
        {/* Payment status (always shown) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Payment</span>
          {(['all', 'paid', 'pending'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPaymentFilter(f)}
              className={pillClass(paymentFilter === f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* SteamOji: Session type filter */}
        {(partnerFilter === 'steamoji') && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Session</span>
            {(['all', 'morning', 'afternoon'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setSessionFilter(f)}
                className={pillClass(sessionFilter === f)}
              >
                {f === 'all' ? 'All' : f === 'morning' ? 'AM' : 'PM'}
              </button>
            ))}
          </div>
        )}

        {/* SteamOji: Week filter */}
        {partnerFilter === 'steamoji' && selectedPartner && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Week</span>
            <button
              onClick={() => setWeekFilter('all')}
              className={pillClass(weekFilter === 'all')}
            >
              All
            </button>
            {selectedPartner.sessions.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setWeekFilter(s.id)}
                className={pillClass(weekFilter === s.id)}
              >
                Wk{i + 1}
              </button>
            ))}
          </div>
        )}

        {/* Avocado: Location filter */}
        {partnerFilter === 'avocado' && selectedPartner?.locations && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Location</span>
            <button
              onClick={() => setLocationFilter('all')}
              className={pillClass(locationFilter === 'all')}
            >
              All
            </button>
            {selectedPartner.locations.map((loc) => (
              <button
                key={loc.slug}
                onClick={() => setLocationFilter(loc.slug)}
                className={pillClass(locationFilter === loc.slug)}
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}

        {/* Avocado: Series filter */}
        {partnerFilter === 'avocado' && partnerSeriesNumbers.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Series</span>
            <button
              onClick={() => setSeriesFilter('all')}
              className={pillClass(seriesFilter === 'all')}
            >
              All
            </button>
            {partnerSeriesNumbers.map((num) => (
              <button
                key={num}
                onClick={() => setSeriesFilter(num!)}
                className={pillClass(seriesFilter === num)}
              >
                Series {num}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-gray-400 mb-3">
        Showing {filtered.length} of {registrations.length} registrations
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
                  {partnerFilter === 'all' && (
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Partner</th>
                  )}
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Parent</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Child</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">
                    {partnerFilter === 'avocado' ? 'Location' : partnerFilter === 'steamoji' ? 'Session' : 'Session'}
                  </th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Weeks</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Payment</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Amount</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    {partnerFilter === 'all' && (
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            partnerColors[r.partner_id] || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {r.partner_id === 'steamoji' ? 'SteamOji' : r.partner_id === 'avocado' ? 'Avocado' : r.partner_id}
                        </span>
                      </td>
                    )}
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
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getSessionBadgeColor(r)}`}
                      >
                        {getSessionLabel(r)}
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
