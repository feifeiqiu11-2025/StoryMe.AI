/**
 * Get Audio Pages for a Project
 * Returns all audio pages for Reading Mode
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
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify project belongs to user
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch audio pages
    const { data: audioPages, error: audioPagesError } = await supabase
      .from('story_audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_number', { ascending: true });

    if (audioPagesError) {
      console.error('Error fetching audio pages:', audioPagesError);
      return NextResponse.json(
        { error: 'Failed to fetch audio pages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      audioPages: audioPages || [],
      hasAudio: (audioPages || []).length > 0,
    });

  } catch (error: any) {
    console.error('Get audio pages error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get audio pages' },
      { status: 500 }
    );
  }
}
