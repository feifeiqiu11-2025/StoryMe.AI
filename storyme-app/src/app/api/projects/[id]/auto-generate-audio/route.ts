/**
 * Auto-Generate Audio API
 *
 * Triggers English audio generation, then Chinese (if bilingual).
 * Designed to be called fire-and-forget from the create page after story save.
 * Calls the existing /api/generate-story-audio endpoint internally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';

// 5 minutes — enough for English + Chinese generation sequentially
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  try {
    const supabase = await createClientFromRequest(request);

    // Verify auth
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Prevent duplicate generation — check for in-progress rows
    const { data: generatingPages } = await supabase
      .from('story_audio_pages')
      .select('id')
      .eq('project_id', projectId)
      .eq('generation_status', 'generating')
      .limit(1);

    if (generatingPages && generatingPages.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Audio generation already in progress',
        alreadyRunning: true,
      });
    }

    // Fetch project to check ownership and bilingual content
    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, scenes(caption_chinese)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const hasBilingual = (project.scenes || []).some(
      (s: any) => s.caption_chinese
    );

    // Forward cookies so internal fetch calls maintain auth
    const cookieHeader = request.headers.get('cookie') || '';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Step 1: Generate English audio
    console.log(`[Auto-Audio] Starting English generation for project ${projectId}`);
    try {
      const enResponse = await fetch(`${baseUrl}/api/generate-story-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({ projectId, language: 'en' }),
      });
      const enData = await enResponse.json();
      console.log(`[Auto-Audio] English result: success=${enData.success}, pages=${enData.successfulPages}/${enData.totalPages}`);
    } catch (err) {
      console.error('[Auto-Audio] English generation failed:', err);
    }

    // Step 2: Generate Chinese audio (if bilingual)
    if (hasBilingual) {
      console.log(`[Auto-Audio] Starting Chinese generation for project ${projectId}`);
      try {
        const zhResponse = await fetch(`${baseUrl}/api/generate-story-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({ projectId, language: 'zh' }),
        });
        const zhData = await zhResponse.json();
        console.log(`[Auto-Audio] Chinese result: success=${zhData.success}, pages=${zhData.successfulPages}/${zhData.totalPages}`);
      } catch (err) {
        console.error('[Auto-Audio] Chinese generation failed:', err);
      }
    }

    console.log(`[Auto-Audio] Completed for project ${projectId}`);
    return NextResponse.json({ success: true, message: 'Audio generation completed' });

  } catch (error: any) {
    console.error('[Auto-Audio] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Auto audio generation failed' },
      { status: 500 }
    );
  }
}
