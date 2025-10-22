/**
 * API Route: Get Spotify Publication Status
 * GET /api/projects/[id]/spotify-status
 *
 * Returns the current Spotify publication status for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Spotify publication record
    const { data: publication, error: publicationError } = await supabase
      .from('publications')
      .select('*')
      .eq('project_id', projectId)
      .eq('platform', 'spotify')
      .eq('user_id', user.id)
      .single();

    if (publicationError && publicationError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, just means not published)
      console.error('Error fetching publication:', publicationError);
      return NextResponse.json({ error: 'Failed to fetch publication status' }, { status: 500 });
    }

    return NextResponse.json({
      hasPublication: !!publication,
      status: publication?.status || null,
      episodeUrl: publication?.external_url || null,
      publishedAt: publication?.published_at || null,
      spotifyLiveAt: publication?.live_at || null,
      errorMessage: publication?.error_message || null,
      compiledAudioUrl: publication?.compiled_audio_url || null,
      duration: publication?.audio_duration_seconds || null,
    });

  } catch (error: any) {
    console.error('Error fetching Spotify status:', error);
    return NextResponse.json({
      error: 'Failed to fetch Spotify status',
      details: error.message
    }, { status: 500 });
  }
}
