'use client';

/**
 * Admin — Survey results.
 * Shows every survey submission, with a survey picker so each survey/round can
 * be viewed on its own. Summary metrics adapt to whichever answer keys exist,
 * so future surveys with different questions still render.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Download } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isAdminEmail } from '@/lib/auth/isAdmin';

interface SurveyRow {
  id: string;
  survey_slug: string;
  survey_type: string;
  answers: Record<string, string | number | boolean | null>;
  name: string | null;
  email: string | null;
  created_at: string;
}

// Numeric answers are stored as codes; map back to the words parents saw.
const EXPECTATIONS_LABELS: Record<number, string> = { 3: 'Exceeded them', 2: 'Met them', 1: 'Fell short' };
const MISSION_LABELS: Record<number, string> = { 4: 'Very well', 3: 'Well', 2: 'Somewhat', 1: 'Not really' };

const KEY_LABEL: Record<string, string> = {
  expectations: 'Expectations',
  enjoyment: 'Child enjoyment',
  mission: 'Storyteller goal',
  recommend: 'Recommend (1-10)',
  keep_creating: 'Keep creating',
  loved_most: 'Loved most',
  improve: 'To improve',
};

// Column order for the workshop survey; unknown keys append after these.
const PREFERRED_ORDER = ['expectations', 'enjoyment', 'mission', 'recommend', 'keep_creating', 'loved_most', 'improve'];
const LONG_TEXT_KEYS = new Set(['loved_most', 'improve']);

function fmtAnswer(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  if (key === 'expectations' && typeof val === 'number') return EXPECTATIONS_LABELS[val] ?? String(val);
  if (key === 'mission' && typeof val === 'number') return MISSION_LABELS[val] ?? String(val);
  return String(val);
}

function keyLabel(key: string): string {
  return KEY_LABEL[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminSurveysPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState<string>('all');

  // --- auth guard (same pattern as other admin pages) ---
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
        const res = await fetch('/api/admin/surveys');
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        setRows(json.data ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [authorized]);

  // --- survey picker options (slug + count) ---
  const surveys = useMemo(() => {
    const by = new Map<string, number>();
    rows.forEach((r) => by.set(r.survey_slug, (by.get(r.survey_slug) ?? 0) + 1));
    return [...by.entries()].map(([s, n]) => ({ slug: s, count: n })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const filtered = useMemo(() => (slug === 'all' ? rows : rows.filter((r) => r.survey_slug === slug)), [rows, slug]);

  // --- summary metrics that adapt to whichever keys exist ---
  const summary = useMemo(() => {
    const numericAvg = (key: string) => {
      const vals = filtered.map((r) => r.answers?.[key]).filter((v): v is number => typeof v === 'number');
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const distribution = (key: string) => {
      const counts = new Map<string, number>();
      filtered.forEach((r) => {
        const v = r.answers?.[key];
        if (typeof v === 'string' && v) counts.set(v, (counts.get(v) ?? 0) + 1);
      });
      return [...counts.entries()].sort((a, b) => b[1] - a[1]);
    };
    return {
      total: filtered.length,
      expectations: numericAvg('expectations'),
      mission: numericAvg('mission'),
      recommend: numericAvg('recommend'),
      enjoyment: distribution('enjoyment'),
      keep_creating: distribution('keep_creating'),
    };
  }, [filtered]);

  // union of answer keys present, ordered
  const answerKeys = useMemo(() => {
    const seen = new Set<string>();
    filtered.forEach((r) => Object.keys(r.answers ?? {}).forEach((k) => seen.add(k)));
    const ordered = PREFERRED_ORDER.filter((k) => seen.has(k));
    const extra = [...seen].filter((k) => !PREFERRED_ORDER.includes(k)).sort();
    return [...ordered, ...extra];
  }, [filtered]);

  function downloadCsv() {
    const cols = ['created_at', 'survey_slug', ...answerKeys, 'name', 'email'];
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines = [cols.map(escape).join(',')];
    filtered.forEach((r) => {
      const cells = [
        new Date(r.created_at).toISOString(),
        r.survey_slug,
        ...answerKeys.map((k) => fmtAnswer(k, r.answers?.[k])),
        r.name ?? '',
        r.email ?? '',
      ];
      lines.push(cells.map((c) => escape(String(c))).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-${slug === 'all' ? 'all' : slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        {/* header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
              <ArrowLeft className="h-4 w-4" /> Admin
            </Link>
            <h1 className="text-2xl font-semibold text-gray-900">Survey results</h1>
            <p className="text-sm text-gray-500">Workshop and product feedback from families.</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/survey"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Open live survey <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={downloadCsv}
              disabled={!filtered.length}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-2 text-sm text-white hover:bg-gray-700 disabled:opacity-40"
            >
              <Download className="h-4 w-4" /> CSV
            </button>
          </div>
        </div>

        {/* survey picker */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-gray-600">Survey:</span>
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800"
          >
            <option value="all">All surveys ({rows.length})</option>
            {surveys.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.slug} ({s.count})
              </option>
            ))}
          </select>
        </div>

        {loading && <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">Loading…</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        {!loading && !error && (
          <>
            {/* summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <Stat label="Responses" value={String(summary.total)} />
              {summary.expectations !== null && (
                <Stat label="Avg expectations" sub="out of 3" value={summary.expectations.toFixed(2)} />
              )}
              {summary.mission !== null && (
                <Stat label="Avg storyteller goal" sub="out of 4" value={summary.mission.toFixed(2)} />
              )}
              {summary.recommend !== null && (
                <Stat label="Avg recommend" sub="out of 10" value={summary.recommend.toFixed(1)} />
              )}
              {summary.keep_creating.length > 0 && (
                <Stat
                  label="Keep creating"
                  sub={`${summary.keep_creating.reduce((a, [, n]) => a + n, 0)} answered`}
                  value={`${pct(summary.keep_creating, 'Yes')}% yes`}
                />
              )}
            </div>

            {/* distributions */}
            {(summary.enjoyment.length > 0 || summary.keep_creating.length > 0) && (
              <div className="mb-6 grid gap-3 md:grid-cols-2">
                {summary.enjoyment.length > 0 && <DistCard title="Child enjoyment" data={summary.enjoyment} />}
                {summary.keep_creating.length > 0 && <DistCard title="Keep creating at home" data={summary.keep_creating} />}
              </div>
            )}

            {/* responses table */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-10 text-center text-gray-500">
                No responses yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Date</th>
                      {answerKeys.map((k) => (
                        <th key={k} className="whitespace-nowrap px-4 py-3 font-medium">
                          {keyLabel(k)}
                        </th>
                      ))}
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Name</th>
                      <th className="whitespace-nowrap px-4 py-3 font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                          {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                        {answerKeys.map((k) => {
                          const text = fmtAnswer(k, r.answers?.[k]);
                          const isLong = LONG_TEXT_KEYS.has(k) || text.length > 32;
                          return (
                            <td key={k} className={`px-4 py-3 text-gray-800 ${isLong ? 'min-w-[220px]' : 'whitespace-nowrap'}`}>
                              {isLong ? <span className="line-clamp-3" title={text}>{text}</span> : text}
                            </td>
                          );
                        })}
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.name ?? '—'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">{r.email ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function pct(dist: [string, number][], key: string): number {
  const total = dist.reduce((a, [, n]) => a + n, 0);
  if (!total) return 0;
  const hit = dist.find(([k]) => k === key)?.[1] ?? 0;
  return Math.round((hit / total) * 100);
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function DistCard({ title, data }: { title: string; data: [string, number][] }) {
  const total = data.reduce((a, [, n]) => a + n, 0);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 text-sm font-medium text-gray-700">{title}</div>
      <div className="space-y-2">
        {data.map(([label, n]) => (
          <div key={label} className="flex items-center gap-3">
            <div className="w-32 shrink-0 truncate text-sm text-gray-600" title={label}>{label}</div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-amber-500" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
            </div>
            <div className="w-10 shrink-0 text-right text-sm tabular-nums text-gray-500">{n}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
