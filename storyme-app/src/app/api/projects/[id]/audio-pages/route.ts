/**
 * Get Audio Pages for a Project
 * Returns all audio pages for Reading Mode
 * PUBLIC endpoint - Kids app needs to access audio for published stories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    if (!projectId) {
      const response = NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }

    // Use service role client to bypass RLS (public endpoint for kids app)
    const supabase = createServiceRoleClient();

    // PUBLIC endpoint - no auth check required
    // Kids app needs to fetch audio for published stories

    // Fetch audio pages (includes quiz transition and quiz question audio)
    const { data: audioPages, error: audioPagesError } = await supabase
      .from('story_audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_number', { ascending: true });

    if (audioPagesError) {
      console.error('Error fetching audio pages:', audioPagesError);
      const response = NextResponse.json(
        { error: 'Failed to fetch audio pages' },
        { status: 500 }
      );
      // Add CORS headers
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }

    // Determine available languages based on audio URLs
    const hasEnglishAudio = (audioPages || []).some((page: any) => page.audio_url);
    const hasChineseAudio = (audioPages || []).some((page: any) => page.audio_url_zh);

    const availableLanguages: string[] = [];
    if (hasEnglishAudio) availableLanguages.push('en');
    if (hasChineseAudio) availableLanguages.push('zh');

    // Format response for kids app
    // Includes: story pages, quiz_transition, and quiz_question pages
    // Now also includes Chinese audio URLs and available languages
    const response = NextResponse.json({
      pages: audioPages || [],
      hasAudio: (audioPages || []).length > 0,
      hasEnglishAudio,
      hasChineseAudio,
      availableLanguages,
    });

    // Add CORS headers for kids app
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error: any) {
    console.error('Get audio pages error:', error);
    const response = NextResponse.json(
      { error: error.message || 'Failed to get audio pages' },
      { status: 500 }
    );
    // Add CORS headers even for errors
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }
}

/**
 * OPTIONS - Handle preflight requests for CORS
 */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}
