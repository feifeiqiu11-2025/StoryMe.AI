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
  limit: z.coerce.number().int().min(1).max(200).default(60),
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
      limit: url.searchParams.get('limit') ?? undefined,
      offset: url.searchParams.get('offset') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.issues },
        { status: 400 }
      );
    }
    const { q, tags, source, limit, offset } = parsed.data;

    let query = supabase
      .from('sfx_library')
      .select('id, name, tags, audio_url, duration_sec, source, kid_safe, attribution, license')
      .eq('kid_safe', true)
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (source) query = query.eq('source', source);
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) query = query.contains('tags', tagList);
    }
    if (q) {
      // Match against name OR any tag. ilike on name, plus an `array_to_string`
      // trick on tags via or() — but Supabase doesn't expose array_to_string,
      // so we use a name-only ilike for now and rely on the tags param for
      // tag-based filtering. The Freesound proxy will handle broader search.
      query = query.ilike('name', `%${q}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('sfx_library query failed:', error);
      return NextResponse.json(
        { error: 'Library query failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sounds: data ?? [] });
  } catch (error: any) {
    console.error('GET /api/v1/sfx-library error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list sounds' },
      { status: 500 }
    );
  }
}
