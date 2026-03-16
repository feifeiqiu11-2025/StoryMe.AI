/**
 * Public Characters API Route
 * GET /api/public-characters - List public characters for the Little Artists gallery
 *
 * Supports:
 * - Pagination: ?page=1&limit=24
 * - Featured filter: ?featured=true (returns up to 10 featured characters for carousel)
 *
 * No authentication required - uses service role to bypass RLS
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceRoleClient();
    const { searchParams } = new URL(request.url);

    const featured = searchParams.get('featured') === 'true';

    if (featured) {
      // Featured mode: return up to 10 featured public characters for carousel
      const { data: characters, error } = await supabase
        .from('character_library')
        .select('id, name, reference_image_url, animated_preview_url, created_at')
        .eq('is_public', true)
        .eq('is_featured', true)
        .not('reference_image_url', 'is', null)
        .not('animated_preview_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error fetching featured characters:', error);
        return NextResponse.json(
          { error: 'Failed to load featured characters' },
          { status: 500 }
        );
      }

      return NextResponse.json({ characters: characters || [] });
    }

    // Paginated mode: return a page of public characters
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '24', 10) || 24));
    const offset = (page - 1) * limit;

    const { data: characters, count, error } = await supabase
      .from('character_library')
      .select('id, name, reference_image_url, animated_preview_url, created_at', { count: 'exact' })
      .eq('is_public', true)
      .not('reference_image_url', 'is', null)
      .not('animated_preview_url', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching public characters:', error);
      return NextResponse.json(
        { error: 'Failed to load public characters' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      characters: characters || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error('Unexpected error in public-characters API:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
