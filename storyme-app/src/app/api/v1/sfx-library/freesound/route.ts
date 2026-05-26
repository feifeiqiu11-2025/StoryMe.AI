/**
 * GET /api/v1/sfx-library/freesound?q=<query>
 *
 * Server-side proxy to the Freesound search API. Keeps our API key off the
 * client and applies the CC0 license filter unconditionally so users can't
 * import licensed-for-attribution sounds into their stories by accident.
 *
 * Why proxy instead of letting clients query Freesound directly:
 *   - API key stays on the server (env var, not bundled)
 *   - We enforce CC0-only — there is no UI option to disable this
 *   - Per-user rate limiting can land here later without touching the client
 *
 * Returns trimmed results matching the SfxLibraryItem shape so the picker
 * can render them with the same grid component as curated entries. The
 * Freesound IDs come back in the `external_id` field so the picker's
 * "+ Add" action can call POST /freesound/import with that ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { searchCC0, attributionFor } from '@/lib/sfx/freesound-client';

// Prefix-based regex against this list filters Freesound results whose
// name OR any tag begins with any of these stems. Prefix matching catches
// inflections ("fuck" → fuck/fucked/fucking/fucker) without us having to
// enumerate every variant. CC0 license is required upstream but says
// nothing about content suitability — this is the kid-safety filter for
// our children's-content product. Add new stems here rather than
// complicating the regex; if a stem produces real false positives,
// remove it and enumerate exact words instead.
const BLOCKED_PREFIXES = [
  // Strong profanity
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'wank', 'twat',
  'asshole', 'bastard',
  // Sexual / adult
  'porn', 'sex', 'nude', 'naked', 'orgasm', 'masturbat', 'fetish', 'kinky',
  'erotic',
  // Drugs
  'cocaine', 'heroin',
  // Slurs — abbreviated examples; expand cautiously
  'nigger', 'faggot', 'retard',
];
// `\bSTEM\w*\b` = word-start, the stem, any trailing word chars, word-end.
// Matches "fuck", "fucked", "fucking" given stem "fuck"; matches "porn",
// "porno" given "porn". Wouldn't match "method" given "meth" because
// "meth" isn't in the list (intentional — too many false positives).
const BLOCKLIST_REGEX = new RegExp(
  `\\b(?:${BLOCKED_PREFIXES.map((t) => t.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')).join('|')})\\w*\\b`,
  'i',
);

function isBlocked(text: string): boolean {
  return BLOCKLIST_REGEX.test(text);
}

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
  pageSize: z.coerce.number().int().min(1).max(30).default(20),
  /** 1-based page number for infinite scroll. */
  page: z.coerce.number().int().min(1).default(1),
  /** sfx (default) → 0.3–30s window. music → 15–180s window so we filter
   *  out one-shot sounds and overly-long tracks. */
  kind: z.enum(['sfx', 'music']).default('sfx'),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const parsed = QuerySchema.safeParse({
      q: url.searchParams.get('q') ?? '',
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
      kind: url.searchParams.get('kind') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // Music tab: longer tracks only (filter out one-shots + impossibly
    // long stems). SFX tab keeps the existing 0.3-30s window.
    const isMusic = parsed.data.kind === 'music';
    const minDur = isMusic ? 15 : 0.3;
    const maxDur = isMusic ? 180 : 30;

    let results;
    try {
      results = await searchCC0({
        query: parsed.data.q,
        pageSize: parsed.data.pageSize,
        page: parsed.data.page,
        sort: 'rating_desc',
        minDurationSec: minDur,
        maxDurationSec: maxDur,
      });
    } catch (err: any) {
      console.error('Freesound search failed:', err);
      return NextResponse.json(
        { error: err.message || 'Freesound search failed' },
        { status: 502 }
      );
    }

    // Belt-and-suspenders client-side filter — Freesound's range filter
    // is mostly reliable but stray results creep through occasionally.
    // Also drop anything matching the kid-safety blocklist (name OR tags).
    const sounds = results
      .filter((r) => r.duration >= minDur && r.duration <= maxDur)
      .filter((r) => {
        if (isBlocked(r.name)) return false;
        if ((r.tags ?? []).some((t) => isBlocked(t))) return false;
        return true;
      })
      .map((r) => ({
        // Pre-import items don't have a sfx_library row yet, so the id field
        // here is a transient identifier — the picker uses it as a React key
        // and passes external_id to the import endpoint.
        id: `freesound-${r.id}`,
        name: r.name,
        tags: r.tags ?? [],
        audio_url: r.previews['preview-hq-mp3'],
        duration_sec: r.duration,
        source: 'freesound' as const,
        external_id: String(r.id),
        kid_safe: true,
        attribution: attributionFor(r),
        license: 'CC0' as const,
      }));

    return NextResponse.json({ sounds });
  } catch (error: any) {
    console.error('GET /api/v1/sfx-library/freesound error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to search' },
      { status: 500 }
    );
  }
}
