/**
 * Admin: Marketing Email Broadcast.
 *
 * Triggers POST /api/admin/send-marketing-email in three modes:
 *   - dry_run: refresh counts + recent-sends list (no actual sending)
 *   - test:    send to hardcoded test recipients in the route
 *   - live:    send up to batch_size to the deduped, opt-out-filtered audience
 *
 * Idempotency is enforced server-side via UNIQUE (campaign_id, LOWER(email))
 * on marketing_email_sends, so re-running 'live' is always safe.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';
import {
  ArrowLeft,
  RefreshCw,
  Send,
  TestTube2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Inbox,
  ShieldCheck,
  Users,
} from 'lucide-react';

const ENDPOINT = '/api/admin/send-marketing-email';

type Campaign = {
  id: string;
  label: string;
  description: string;
};

const CAMPAIGNS: Campaign[] = [
  {
    id: 'spark-letter-1',
    label: "Spark's first letter",
    description: 'KindleWood is on Android — multilingual update with the dragon-mascot origin.',
  },
  {
    id: 'summer-workshop-2026',
    label: 'Summer 2026 — Creative Storyteller Series',
    description:
      'KindleWood × Steamoji co-hosted workshop announcement. Sends to past workshop attendees only (confirmed registrations, any partner).',
  },
];

interface DryRunResponse {
  success: true;
  mode: 'dry_run';
  campaign_id: string;
  counts: {
    total_recipients: number;
    opted_out: number;
    already_sent: number;
    eligible: number;
    will_send_in_this_batch: number;
  };
  sample_eligible: string[];
  recent_sends: RecentSend[];
}

interface SendResponse {
  success: true;
  mode: 'test' | 'live';
  campaign_id: string;
  counts: {
    total_recipients: number;
    opted_out: number;
    already_sent_before_this_call: number;
    sent_this_call: number;
    failed_this_call: number;
    remaining_eligible: number;
  };
  failed_details: { email: string; error: string }[];
}

interface RecentSend {
  email: string;
  status: 'sent' | 'failed';
  sent_at: string;
  resend_message_id: string | null;
  error: string | null;
}

interface ErrorResponse {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

type ApiResponse = DryRunResponse | SendResponse | ErrorResponse;

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function maskEmail(e: string): string {
  const [user, domain] = e.split('@');
  if (!user || !domain) return e;
  if (user.length <= 3) return `${user[0]}***@${domain}`;
  return `${user.slice(0, 2)}***${user.slice(-1)}@${domain}`;
}

export default function AdminMarketingEmailPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [campaignId, setCampaignId] = useState<string>(CAMPAIGNS[0].id);
  const [dryRun, setDryRun] = useState<DryRunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<SendResponse | ErrorResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [batchSize, setBatchSize] = useState(50);
  const [revealEmails, setRevealEmails] = useState(false);

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

  const refresh = useCallback(async () => {
    setLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, mode: 'dry_run' }),
      });
      const json = (await res.json()) as ApiResponse;
      if (json.success && json.mode === 'dry_run') setDryRun(json);
      else setActionResult(json as ErrorResponse);
    } catch (e) {
      setActionResult({
        success: false,
        error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    if (authorized) refresh();
  }, [authorized, refresh]);

  const fireTest = async () => {
    setLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, mode: 'test' }),
      });
      const json = (await res.json()) as ApiResponse;
      setActionResult(json as SendResponse | ErrorResponse);
    } catch (e) {
      setActionResult({
        success: false,
        error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      setLoading(false);
    }
  };

  const fireLive = async () => {
    setConfirming(false);
    setLoading(true);
    setActionResult(null);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign_id: campaignId, mode: 'live', batch_size: batchSize }),
      });
      const json = (await res.json()) as ApiResponse;
      setActionResult(json as SendResponse | ErrorResponse);
      // refresh counts after a send
      void refresh();
    } catch (e) {
      setActionResult({
        success: false,
        error: { code: 'NETWORK_ERROR', message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      setLoading(false);
    }
  };

  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  const counts = dryRun?.counts;
  const willSend = Math.min(counts?.eligible ?? 0, batchSize);
  const campaign = CAMPAIGNS.find((c) => c.id === campaignId)!;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Admin
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Marketing Email Broadcast
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Send campaign emails to your recipient audience. All sends are throttled, opt-out filtered,
          and idempotent.
        </p>
      </div>

      {/* Campaign selector */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Campaign
            </label>
            <div className="mt-2 flex items-center gap-2">
              <select
                value={campaignId}
                onChange={(e) => setCampaignId(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              >
                {CAMPAIGNS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <code className="text-xs text-gray-400 font-mono">{campaignId}</code>
            </div>
            <p className="text-sm text-gray-600 mt-2">{campaign.description}</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard
          icon={<Users className="w-4 h-4" />}
          label="Total recipients"
          value={counts?.total_recipients ?? '—'}
          loading={loading && !dryRun}
        />
        <StatCard
          icon={<ShieldCheck className="w-4 h-4" />}
          label="Opted out"
          value={counts?.opted_out ?? '—'}
          loading={loading && !dryRun}
          tone="muted"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Already sent"
          value={counts?.already_sent ?? '—'}
          loading={loading && !dryRun}
          tone="muted"
        />
        <StatCard
          icon={<Send className="w-4 h-4" />}
          label="Eligible"
          value={counts?.eligible ?? '—'}
          loading={loading && !dryRun}
          tone="primary"
        />
      </div>

      {/* Sample preview */}
      {dryRun && counts && counts.eligible > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Sample of who will receive this batch
            </h2>
            <button
              onClick={() => setRevealEmails((v) => !v)}
              className="text-xs text-gray-500 hover:text-gray-900"
            >
              {revealEmails ? 'Mask' : 'Reveal'}
            </button>
          </div>
          <ul className="text-sm text-gray-700 font-mono space-y-1">
            {dryRun.sample_eligible.map((e) => (
              <li key={e}>{revealEmails ? e : maskEmail(e)}</li>
            ))}
          </ul>
          {counts.eligible > dryRun.sample_eligible.length && (
            <p className="text-xs text-gray-400 mt-3">
              + {counts.eligible - dryRun.sample_eligible.length} more
            </p>
          )}
        </div>
      )}

      {/* Action panel */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">Actions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={fireTest}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <TestTube2 className="w-4 h-4" />
            Test send
          </button>

          <div className="inline-flex items-center gap-2 ml-auto">
            <label className="text-xs text-gray-500">Batch size</label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) =>
                setBatchSize(Math.max(1, Math.min(100, Number(e.target.value) || 50)))
              }
              min={1}
              max={100}
              className="w-16 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
            <button
              onClick={() => setConfirming(true)}
              disabled={loading || !counts || counts.eligible === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              Send live batch
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Test send goes only to the hardcoded test recipients in the route. Live batch sends
          throttled at 600ms (≈1.7/sec). Free tier limit is 100 emails/day. Re-run safely; duplicates
          are blocked by a UNIQUE constraint.
        </p>
      </div>

      {/* Action result */}
      {actionResult && <ActionResult result={actionResult} />}

      {/* Recent sends table */}
      {dryRun && dryRun.recent_sends.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
            <Inbox className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Recent sends</h2>
            <span className="text-xs text-gray-400 ml-auto">
              Last {dryRun.recent_sends.length}, most recent first
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="text-left font-medium px-5 py-2.5">Email</th>
                <th className="text-left font-medium px-5 py-2.5">Status</th>
                <th className="text-left font-medium px-5 py-2.5">When</th>
                <th className="text-left font-medium px-5 py-2.5">Resend ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dryRun.recent_sends.map((row) => (
                <tr key={`${row.email}-${row.sent_at}`} className="hover:bg-gray-50">
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-700">
                    {revealEmails ? row.email : maskEmail(row.email)}
                  </td>
                  <td className="px-5 py-2.5">
                    {row.status === 'sent' ? (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        sent
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700" title={row.error || undefined}>
                        <XCircle className="w-3.5 h-3.5" />
                        failed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-2.5 text-xs text-gray-500">{formatRelative(row.sent_at)}</td>
                  <td className="px-5 py-2.5 font-mono text-xs text-gray-400">
                    {row.resend_message_id ? row.resend_message_id.slice(0, 12) + '…' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation modal */}
      {confirming && counts && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Send live batch?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  About to send <strong>{willSend}</strong> emails to real users via Resend. This
                  cannot be undone.
                </p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-md px-4 py-3 text-sm text-gray-700 mb-5 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Campaign</span>
                <code className="font-mono text-xs">{campaignId}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Eligible</span>
                <span>{counts.eligible}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">This batch</span>
                <strong>{willSend}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Remaining after</span>
                <span>{counts.eligible - willSend}</span>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={fireLive}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
              >
                <Send className="w-4 h-4" />
                Confirm send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  loading?: boolean;
  tone?: 'default' | 'primary' | 'muted';
}) {
  const valueClass =
    tone === 'primary'
      ? 'text-gray-900'
      : tone === 'muted'
        ? 'text-gray-500'
        : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3.5">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${valueClass}`}>
        {loading ? <span className="text-gray-300">—</span> : value}
      </div>
    </div>
  );
}

function ActionResult({ result }: { result: SendResponse | ErrorResponse }) {
  if (!result.success) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-900">{result.error.code}</h3>
            <p className="text-sm text-red-700 mt-0.5">{result.error.message}</p>
            {result.error.details ? (
              <pre className="text-xs text-red-600 mt-2 font-mono whitespace-pre-wrap">
                {JSON.stringify(result.error.details, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const sent = result.counts.sent_this_call;
  const failed = result.counts.failed_this_call;
  const remaining = result.counts.remaining_eligible;
  const tone =
    failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50';
  const Icon = failed > 0 ? AlertTriangle : CheckCircle2;
  const iconColor = failed > 0 ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`border rounded-lg p-4 mb-6 ${tone}`}>
      <div className="flex items-start gap-2">
        <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconColor}`} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 capitalize">
            {result.mode} send complete
          </h3>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700 mt-1">
            <span>
              <strong>{sent}</strong> sent
            </span>
            {failed > 0 && (
              <span className="text-red-700">
                <strong>{failed}</strong> failed
              </span>
            )}
            {result.mode === 'live' && (
              <span>
                <strong>{remaining}</strong> remaining eligible
              </span>
            )}
          </div>
          {result.failed_details.length > 0 && (
            <details className="mt-2 text-xs text-gray-700">
              <summary className="cursor-pointer hover:text-gray-900">View failures</summary>
              <pre className="mt-2 font-mono whitespace-pre-wrap">
                {result.failed_details
                  .map((f) => `${f.email}: ${f.error}`)
                  .join('\n')}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
