/**
 * Gallery Tags API Route
 * GET /api/gallery-tags - List unique tags from public characters
 *
 * No authentication required - public endpoint for gallery filtering.
 * Returns distinct tags used across all public characters, sorted alphabetically.
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Fetch tags arrays from all public characters that have tags
    const { data: characters, error } = await supabase
      .from('character_library')
      .select('tags')
      .eq('is_public', true)
      .not('tags', 'eq', '{}');

    if (error) {
      console.error('Error fetching gallery tags:', error);
      return NextResponse.json({ error: 'Failed to load tags' }, { status: 500 });
    }

    // Extract unique tags
    const tagSet = new Set<string>();
    (characters || []).forEach((char) => {
      if (Array.isArray(char.tags)) {
        char.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });

    const tags = Array.from(tagSet).sort();
    const response = NextResponse.json({ tags });
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err) {
    console.error('Unexpected error in gallery-tags API:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
