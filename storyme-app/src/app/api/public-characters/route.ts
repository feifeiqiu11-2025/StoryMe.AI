/**
 * Public Characters API Route
 * GET /api/public-characters - List public characters for the Little Artists gallery
 * No authentication required - uses service role to bypass RLS
 */

import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    const { data: characters, error } = await supabase
      .from('character_library')
      .select('id, name, reference_image_url, animated_preview_url, created_at')
      .eq('is_public', true)
      .not('reference_image_url', 'is', null)
      .not('animated_preview_url', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching public characters:', error);
      return NextResponse.json(
        { error: 'Failed to load public characters' },
        { status: 500 }
      );
    }

    return NextResponse.json({ characters: characters || [] });
  } catch (err) {
    console.error('Unexpected error in public-characters API:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
