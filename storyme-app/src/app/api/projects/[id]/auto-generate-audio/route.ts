/**
 * Auto-Generate Audio API
 *
 * Triggers English audio generation, then secondary language (if bilingual).
 * Designed to be called fire-and-forget from the create page after story save.
 * Calls the existing /api/generate-story-audio endpoint internally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getLanguageLabel } from '@/lib/config/languages';

// 5 minutes — enough for English + secondary language generation sequentially
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

    // Fetch project to check ownership, secondary language, and bilingual content
    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, secondary_language, scenes(caption_chinese, caption_secondary)')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const secondaryLanguage = project.secondary_language || null;
    const hasBilingual = (project.scenes || []).some(
      (s: any) => s.caption_secondary || s.caption_chinese
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

    // Step 2: Generate secondary language audio (if bilingual)
    if (hasBilingual && secondaryLanguage) {
      const langLabel = getLanguageLabel(secondaryLanguage);
      console.log(`[Auto-Audio] Starting ${langLabel} (${secondaryLanguage}) generation for project ${projectId}`);
      try {
        const secResponse = await fetch(`${baseUrl}/api/generate-story-audio`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader,
          },
          body: JSON.stringify({ projectId, language: secondaryLanguage }),
        });
        const secData = await secResponse.json();
        console.log(`[Auto-Audio] ${langLabel} result: success=${secData.success}, pages=${secData.successfulPages}/${secData.totalPages}`);
      } catch (err) {
        console.error(`[Auto-Audio] ${langLabel} generation failed:`, err);
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
