/**
 * Get Audio Pages for a Project
 * Returns all audio pages for Reading Mode
 * PUBLIC endpoint - Kids app needs to access audio for published stories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Initialize Supabase client
    const supabase = await createClient();

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

    // Format response for kids app
    // Includes: story pages, quiz_transition, and quiz_question pages
    const response = NextResponse.json({
      pages: audioPages || [],
      hasAudio: (audioPages || []).length > 0,
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
