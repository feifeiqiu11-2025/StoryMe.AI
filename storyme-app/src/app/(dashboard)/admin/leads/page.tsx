'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

interface Lead {
  id: string;
  email: string;
  name: string | null;
  interest: 'job' | 'school_partnership' | 'product_interest' | 'other';
  source: string;
  source_medium: 'qr_code' | 'web' | 'in_person' | 'referral' | null;
  auth_provider: 'google' | 'apple' | 'email' | null;
  user_id: string | null;
  message: string | null;
  consent_marketing: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

const INTEREST_LABEL: Record<Lead['interest'], string> = {
  job: 'Job',
  school_partnership: 'School/Educator',
  product_interest: 'Product',
  other: 'Other',
};

const INTEREST_PILL: Record<Lead['interest'], string> = {
  job: 'bg-amber-100 text-amber-800',
  school_partnership: 'bg-blue-100 text-blue-800',
  product_interest: 'bg-emerald-100 text-emerald-800',
  other: 'bg-gray-100 text-gray-700',
};

export default function AdminLeadsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [interestFilter, setInterestFilter] = useState<string>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
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
    })();
  }, [router]);

  useEffect(() => {
    if (!authorized) return;
    (async () => {
      try {
        const res = await fetch('/api/admin/leads');
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? 'Failed to load leads');
        }
        setLeads(json.data as Lead[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized]);

  const sources = useMemo(() => {
    const set = new Set(leads.map((l) => l.source));
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return leads.filter((l) => {
      if (sourceFilter !== 'all' && l.source !== sourceFilter) return false;
      if (interestFilter !== 'all' && l.interest !== interestFilter) return false;
      if (q && !l.email.toLowerCase().includes(q) && !(l.name ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [leads, sourceFilter, interestFilter, query]);

  function exportCsv() {
    const header = [
      'created_at',
      'name',
      'email',
      'interest',
      'source',
      'source_medium',
      'auth_provider',
      'consent_marketing',
      'message',
    ];
    const rows = filtered.map((l) => [
      l.created_at,
      l.name ?? '',
      l.email,
      l.interest,
      l.source,
      l.source_medium ?? '',
      l.auth_provider ?? '',
      l.consent_marketing ? 'yes' : 'no',
      (l.message ?? '').replace(/\s+/g, ' ').slice(0, 500),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-[0.14em]">
            <Link href="/admin" className="hover:text-gray-600">Admin</Link> / Leads
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-gray-900 tracking-tight">
            Leads
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Inbound contact submissions from /contact. {filtered.length} shown
            {filtered.length !== leads.length ? ` of ${leads.length}` : ''}.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="inline-flex items-center px-3 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Export CSV
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or email"
          className="min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-gray-500"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:border-gray-500"
        >
          <option value="all">All sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={interestFilter}
          onChange={(e) => setInterestFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:border-gray-500"
        >
          <option value="all">All interests</option>
          <option value="job">Job</option>
          <option value="school_partnership">School/Educator</option>
          <option value="product_interest">Product</option>
          <option value="other">Other</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-7 w-7 border-2 border-gray-200 border-t-gray-900" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-gray-500 border border-dashed border-gray-300 rounded-md">
          {leads.length === 0 ? 'No leads yet.' : 'No leads match these filters.'}
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>Date</Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Interest</Th>
                <Th>Source</Th>
                <Th>Via</Th>
                <Th>Consent</Th>
                <Th>Message</Th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <Td className="text-gray-500 whitespace-nowrap">
                    {new Date(lead.created_at).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Td>
                  <Td className="text-gray-900">{lead.name ?? '—'}</Td>
                  <Td>
                    <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                      {lead.email}
                    </a>
                  </Td>
                  <Td>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${INTEREST_PILL[lead.interest]}`}>
                      {INTEREST_LABEL[lead.interest]}
                    </span>
                  </Td>
                  <Td className="text-gray-700 whitespace-nowrap">{lead.source}</Td>
                  <Td className="text-gray-500 whitespace-nowrap">
                    {lead.auth_provider ?? lead.source_medium ?? 'web'}
                  </Td>
                  <Td className="text-gray-500">
                    {lead.consent_marketing ? 'yes' : 'no'}
                  </Td>
                  <Td className="text-gray-700 max-w-md">
                    <span className="line-clamp-2">{lead.message ?? '—'}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
      {children}
    </th>
  );
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}
