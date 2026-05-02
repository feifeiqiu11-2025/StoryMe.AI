/**
 * Admin: School Bundles
 * /admin/school-bundles
 *
 * Group 4 teacher accounts under one school for shared monthly billing.
 * Stripe handles all billing UI (cards, invoices, cancellation) via Customer Portal.
 */

'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

interface BundleSummary {
  teamId: string;
  schoolName: string;
  primaryEmail: string;
  memberCount: number;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  taxExempt: boolean;
  checkoutUrl: string | null;
  checkoutExpiresAt: string | null;
}

interface Member {
  userId: string;
  email: string;
  isPrimary: boolean;
  tier: string | null;
}

const statusBadge: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  checkout_expired: 'bg-orange-100 text-orange-800',
  incomplete: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  past_due: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-700',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function AdminSchoolBundlesPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [bundles, setBundles] = useState<BundleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [latestCheckout, setLatestCheckout] = useState<{ url: string; expiresAt: string } | null>(null);

  // form state
  const [schoolName, setSchoolName] = useState('');
  const [primaryEmail, setPrimaryEmail] = useState('');
  const [member2, setMember2] = useState('');
  const [member3, setMember3] = useState('');
  const [member4, setMember4] = useState('');

  // expansion + member management state
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [membersByTeam, setMembersByTeam] = useState<Record<string, Member[]>>({});
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({});
  const [addEmailInput, setAddEmailInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [memberError, setMemberError] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      if (!isAdminEmail(user.email)) { router.push('/dashboard'); return; }
      setAuthorized(true);
    };
    check();
  }, [router]);

  const loadBundles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/school-bundles');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setBundles(json.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bundles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authorized) loadBundles();
  }, [authorized, loadBundles]);

  const resetForm = () => {
    setSchoolName('');
    setPrimaryEmail('');
    setMember2('');
    setMember3('');
    setMember4('');
    setCreateError(null);
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const memberEmails = [member2, member3, member4].map(e => e.trim()).filter(Boolean);
      const res = await fetch('/api/admin/school-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schoolName, primaryEmail, memberEmails }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || 'Failed to create bundle');
        return;
      }
      setLatestCheckout({ url: json.data.checkoutUrl, expiresAt: json.data.checkoutExpiresAt });
      resetForm();
      setCreateOpen(false);
      await loadBundles();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create bundle');
    } finally {
      setCreating(false);
    }
  };

  const handleManageBilling = async (teamId: string) => {
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/portal`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to open billing portal');
        return;
      }
      window.open(json.data.url, '_blank');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to open billing portal');
    }
  };

  const handleRegenerate = async (teamId: string) => {
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/regenerate-checkout`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to regenerate checkout');
        return;
      }
      setLatestCheckout({ url: json.data.checkoutUrl, expiresAt: json.data.checkoutExpiresAt });
      await loadBundles();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to regenerate');
    }
  };

  const handleTaxExempt = async (teamId: string, current: boolean) => {
    const next = !current;
    let note: string | undefined;
    if (next) {
      note = window.prompt('Tax-exempt note (cert ID, jurisdiction, etc.)') || undefined;
    }
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/tax-exempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exempt: next, note }),
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed'); return; }
      await loadBundles();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleDelete = async (teamId: string, schoolName: string) => {
    if (!window.confirm(`Delete bundle "${schoolName}"? This unstamps users but keeps Stripe data.`)) return;
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || 'Failed to delete'); return; }
      await loadBundles();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // small visual ack
    });
  };

  const loadMembers = async (teamId: string) => {
    setMembersLoading((s) => ({ ...s, [teamId]: true }));
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/members`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load members');
      setMembersByTeam((s) => ({ ...s, [teamId]: json.data || [] }));
    } catch (e) {
      setMemberError((s) => ({ ...s, [teamId]: e instanceof Error ? e.message : 'Failed' }));
    } finally {
      setMembersLoading((s) => ({ ...s, [teamId]: false }));
    }
  };

  const handleToggleExpand = (teamId: string) => {
    if (expandedTeamId === teamId) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(teamId);
    setAddEmailInput('');
    setMemberError((s) => ({ ...s, [teamId]: null }));
    if (!membersByTeam[teamId]) loadMembers(teamId);
  };

  const handleAddMember = async (teamId: string) => {
    if (!addEmailInput.trim()) return;
    setAdding(true);
    setMemberError((s) => ({ ...s, [teamId]: null }));
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmailInput.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMemberError((s) => ({ ...s, [teamId]: json.error || 'Failed to add' }));
        return;
      }
      setAddEmailInput('');
      await Promise.all([loadMembers(teamId), loadBundles()]);
    } catch (e) {
      setMemberError((s) => ({ ...s, [teamId]: e instanceof Error ? e.message : 'Failed' }));
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string, email: string) => {
    if (!window.confirm(`Remove ${email} from this bundle? Their tier reverts to free.`)) return;
    setMemberError((s) => ({ ...s, [teamId]: null }));
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/members/${userId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        setMemberError((s) => ({ ...s, [teamId]: json.error || 'Failed to remove' }));
        return;
      }
      await Promise.all([loadMembers(teamId), loadBundles()]);
    } catch (e) {
      setMemberError((s) => ({ ...s, [teamId]: e instanceof Error ? e.message : 'Failed' }));
    }
  };

  const handleEmailLink = async (teamId: string, primaryEmail: string) => {
    try {
      const res = await fetch(`/api/admin/school-bundles/${teamId}/send-email`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error || 'Failed to send email');
        return;
      }
      alert(`Email sent to ${primaryEmail}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed');
    }
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">School Bundles</h1>
          <p className="text-gray-600 mt-1">Group 4 teacher accounts under one school for shared monthly billing.</p>
        </div>
        <button
          onClick={() => { setCreateOpen(o => !o); setCreateError(null); }}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
        >
          {createOpen ? 'Close' : 'New Bundle'}
        </button>
      </div>

      {/* Latest Checkout URL banner */}
      {latestCheckout && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-green-900 mb-1">Checkout link ready — send to school primary</p>
              <p className="text-sm text-green-800 mb-2">
                Expires {formatDate(latestCheckout.expiresAt)} (~24 hours — Stripe&apos;s hard cap). Send to the school admin promptly. If it expires, click <strong>Regenerate</strong> on the bundle row for a fresh link.
              </p>
              <code className="block text-xs bg-white border border-green-200 rounded px-2 py-1.5 break-all">
                {latestCheckout.url}
              </code>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => copyToClipboard(latestCheckout.url)}
                className="px-3 py-1.5 bg-white border border-green-300 rounded text-sm hover:bg-green-100"
              >
                Copy link
              </button>
              <button
                onClick={() => setLatestCheckout(null)}
                className="px-3 py-1.5 text-sm text-green-800 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {createOpen && (
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-5 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Create New Bundle</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Lincoln Elementary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Primary teacher (billing email)</label>
              <input
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="jane@lincoln.edu"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher 2</label>
                <input type="email" value={member2} onChange={(e) => setMember2(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher 3</label>
                <input type="email" value={member3} onChange={(e) => setMember3(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teacher 4</label>
                <input type="email" value={member4} onChange={(e) => setMember4(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="optional" />
              </div>
            </div>
            <p className="text-xs text-gray-500">All teachers must have an existing KW account. Bundle is monthly, $X/mo (configured in Stripe).</p>
            {createError && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm rounded px-3 py-2 whitespace-pre-wrap">
                {createError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCreate}
                disabled={creating || !schoolName.trim() || !primaryEmail.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create + Generate Checkout link'}
              </button>
              <button
                onClick={() => { setCreateOpen(false); resetForm(); }}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing bundles table */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading bundles…</div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded p-4">{error}</div>
      ) : bundles.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
          No school bundles yet. Click <strong>New Bundle</strong> to create one.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">School</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Primary</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Members</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Next Bill</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Tax</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((b) => {
                const status = b.status || 'pending';
                const isPending = status === 'pending' || status === 'checkout_expired';
                const isActive = status === 'active' || status === 'past_due' || status === 'incomplete';
                const isDeletable = status === 'pending' || status === 'checkout_expired' || status === 'cancelled';
                const isExpanded = expandedTeamId === b.teamId;
                const members = membersByTeam[b.teamId] || [];
                const memErr = memberError[b.teamId];
                const checkoutValid = !!b.checkoutUrl
                  && !!b.checkoutExpiresAt
                  && new Date(b.checkoutExpiresAt).getTime() > Date.now();
                return (
                  <Fragment key={b.teamId}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleToggleExpand(b.teamId)}
                          className="text-gray-400 hover:text-gray-700 text-xs"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{b.schoolName}</td>
                      <td className="px-4 py-3 text-gray-600">{b.primaryEmail}</td>
                      <td className="px-4 py-3 text-gray-600">{b.memberCount}/4</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge[status] || 'bg-gray-100 text-gray-700'}`}>
                          {status}{b.cancelAtPeriodEnd ? ' (cancelling)' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(b.currentPeriodEnd)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleTaxExempt(b.teamId, b.taxExempt)}
                          disabled={!isActive}
                          className={`text-xs px-2 py-0.5 rounded border ${b.taxExempt ? 'bg-blue-50 border-blue-300 text-blue-800' : 'bg-white border-gray-300 text-gray-600'} disabled:opacity-40`}
                          title={isActive ? 'Toggle tax-exempt status' : 'Available once active'}
                        >
                          {b.taxExempt ? 'Exempt' : 'Taxable'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          {isPending && b.checkoutUrl && (
                            <button
                              onClick={() => copyToClipboard(b.checkoutUrl!)}
                              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Copy link
                            </button>
                          )}
                          {isPending && checkoutValid && (
                            <button
                              onClick={() => handleEmailLink(b.teamId, b.primaryEmail)}
                              className="text-xs px-2 py-1 bg-white border border-purple-300 text-purple-700 rounded hover:bg-purple-50"
                              title="Email Checkout link to primary teacher"
                            >
                              Email link
                            </button>
                          )}
                          {isPending && (
                            <button
                              onClick={() => handleRegenerate(b.teamId)}
                              className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Regenerate
                            </button>
                          )}
                          {isActive && (
                            <button
                              onClick={() => handleManageBilling(b.teamId)}
                              className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                            >
                              Manage Billing
                            </button>
                          )}
                          {isDeletable && (
                            <button
                              onClick={() => handleDelete(b.teamId, b.schoolName)}
                              className="text-xs px-2 py-1 bg-white border border-red-300 text-red-700 rounded hover:bg-red-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <td></td>
                        <td colSpan={7} className="px-4 py-3">
                          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Members</div>
                          {membersLoading[b.teamId] ? (
                            <div className="text-sm text-gray-500">Loading…</div>
                          ) : members.length === 0 ? (
                            <div className="text-sm text-gray-500">No members yet</div>
                          ) : (
                            <ul className="space-y-1.5 mb-3">
                              {members.map((m) => (
                                <li key={m.userId} className="flex items-center gap-3 text-sm">
                                  <span className="text-gray-800">{m.email}</span>
                                  {m.isPrimary && (
                                    <span className="text-xs text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">primary · billing</span>
                                  )}
                                  <span className="text-xs text-gray-500">{m.tier || '—'}</span>
                                  {!m.isPrimary && status !== 'cancelled' && (
                                    <button
                                      onClick={() => handleRemoveMember(b.teamId, m.userId, m.email)}
                                      className="ml-auto text-xs text-red-700 hover:underline"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                          {b.memberCount < 4 && status !== 'cancelled' && (
                            <div className="flex gap-2 items-center pt-2 border-t border-gray-200">
                              <input
                                type="email"
                                value={addEmailInput}
                                onChange={(e) => setAddEmailInput(e.target.value)}
                                placeholder="teacher@school.edu"
                                className="flex-1 max-w-xs text-sm border border-gray-300 rounded px-2 py-1"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddMember(b.teamId); }}
                              />
                              <button
                                onClick={() => handleAddMember(b.teamId)}
                                disabled={adding || !addEmailInput.trim()}
                                className="text-sm px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                              >
                                {adding ? 'Adding…' : 'Add member'}
                              </button>
                            </div>
                          )}
                          {memErr && (
                            <div className="mt-2 bg-red-50 border border-red-200 text-red-800 text-xs rounded px-2 py-1.5">
                              {memErr}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-xs text-gray-500">
        Tip: <strong>Manage Billing</strong> opens the Stripe Customer Portal where the school can update card,
        view invoices, switch payment method, or cancel. We don&apos;t duplicate that UI here.
      </p>
    </div>
  );
}
