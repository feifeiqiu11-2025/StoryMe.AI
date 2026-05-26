/**
 * GET /api/v1/sfx-library
 *
 * Lists curated sound-effects available to all users. Optional filters:
 *   ?q=<text>           — fuzzy match against name + tags
 *   ?tags=a,b,c         — must contain ALL listed tags
 *   ?source=curated     — limit to one source (curated|freesound|elevenlabs_cache)
 *   ?limit=N&offset=M   — pagination (default 60, max 200)
 *
 * Returns: { sounds: SfxLibraryItem[] }
 *
 * Reads are open to any authenticated user — RLS allows public SELECT
 * because the audio is CC0/cleared for commercial use.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';

const QuerySchema = z.object({
  q: z.string().max(100).optional(),
  tags: z.string().max(200).optional(),
  source: z.enum(['curated', 'freesound', 'elevenlabs_cache']).optional(),
  /** sfx | music — top-level tab in the recorder browser panel.
   *  Defaults to sfx so existing callers (the SFX picker, the audio
   *  layers hydration lookup) get unchanged behavior. */
  kind: z.enum(['sfx', 'music']).optional(),
  /** Comma-separated UUIDs — when present, the library returns ONLY these
   *  rows (ignoring q/tags/source/kind/limit/offset). Used by the Recorder
   *  to hydrate saved SFX/music placements on re-open. */
  ids: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(30),
  offset: z.coerce.number().int().min(0).default(0),
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
      q: url.searchParams.get('q') ?? undefined,
      tags: url.searchParams.get('tags') ?? undefined,
      source: url.searchParams.get('source') ?? undefined,
      kind: url.searchParams.get('kind') ?? undefined,
      ids: url.searchParams.get('ids') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { q, tags, source, kind, ids, limit, offset } = parsed.data;

    // ids-mode: batch-fetch by UUID list, bypass all other filters. Used
    // by the recorder to hydrate saved placements on re-open. Returns
    // BOTH sfx and music rows since the recorder hydrates from a single
    // sfxLibraryId regardless of kind.
    if (ids) {
      const idList = ids.split(',').map((s) => s.trim()).filter(Boolean);
      if (idList.length === 0) return NextResponse.json({ sounds: [] });
      const { data, error } = await supabase
        .from('sfx_library')
        .select('id, name, tags, audio_url, duration_sec, source, kid_safe, attribution, license, kind')
        .in('id', idList);
      if (error) {
        console.error('sfx_library ids query failed:', error);
        return NextResponse.json({ error: 'Library query failed' }, { status: 500 });
      }
      return NextResponse.json({ sounds: data ?? [] });
    }

    let query = supabase
      .from('sfx_library')
      .select('id, name, tags, audio_url, duration_sec, source, kid_safe, attribution, license, kind', { count: 'exact' })
      .eq('kid_safe', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq('source', source);
    // Default to kind='sfx' for back-compat — old callers never passed
    // kind and expect SFX-only results.
    query = query.eq('kind', kind ?? 'sfx');
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) query = query.contains('tags', tagList);
    }
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      console.error('sfx_library query failed:', error);
      return NextResponse.json(
        { error: 'Library query failed' },
        { status: 500 }
      );
    }

    const hasMore = typeof count === 'number' ? offset + (data?.length ?? 0) < count : false;
    return NextResponse.json({ sounds: data ?? [], hasMore });
  } catch (error: any) {
    console.error('GET /api/v1/sfx-library error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list sounds' },
      { status: 500 }
    );
  }
}
