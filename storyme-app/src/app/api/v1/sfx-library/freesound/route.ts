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

const QuerySchema = z.object({
  q: z.string().min(2).max(100),
  pageSize: z.coerce.number().int().min(1).max(30).default(20),
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
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.issues },
        { status: 400 }
      );
    }

    let results;
    try {
      results = await searchCC0({
        query: parsed.data.q,
        pageSize: parsed.data.pageSize,
        sort: 'rating_desc',
      });
    } catch (err: any) {
      console.error('Freesound search failed:', err);
      return NextResponse.json(
        { error: err.message || 'Freesound search failed' },
        { status: 502 }
      );
    }

    // Filter out anything outside our 0.3–30s window so the picker doesn't
    // show items the import endpoint will reject. Map to the same shape as
    // SfxLibraryItem so the picker can render a uniform grid.
    const sounds = results
      .filter((r) => r.duration >= 0.3 && r.duration <= 30)
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
