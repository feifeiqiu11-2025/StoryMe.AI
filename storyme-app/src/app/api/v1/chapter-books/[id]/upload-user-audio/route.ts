/**
 * POST /api/v1/chapter-books/[id]/upload-user-audio
 *
 * Uploads a user-recorded narration for ONE chapter-book page. FormData:
 *   - pageNumber: 1-based page index
 *   - language: 'en' or secondary language code
 *   - voiceProfileName: label for the voice profile (e.g. "Dad's Voice")
 *   - duration: integer seconds (from MediaRecorder)
 *   - audio: the WebM/MP4 blob from the browser
 *
 * Uses shared upload-recording.service primitive for WebM→MP3 conversion +
 * storage upload. Owns the chapter-book-specific DB row write (content_hash,
 * page_type='chapter_page', voice_profile linkage).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { docToPages } from '@/lib/chapter-book/docToPages';
import { hashPageContent } from '@/lib/audio/content-hash';
import { processAndUploadRecording } from '@/lib/audio/upload-recording.service';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const pageNumberRaw = formData.get('pageNumber');
    const language = (formData.get('language') as string) || 'en';
    const voiceProfileName = (formData.get('voiceProfileName') as string) || `${user.email?.split('@')[0] || 'User'}'s Voice`;
    const durationRaw = formData.get('duration');
    const audioFile = formData.get('audio') as File | null;
    const trimStartRaw = formData.get('trimStart');
    const trimEndRaw = formData.get('trimEnd');
    const trimStartSec = trimStartRaw == null ? undefined : Number(trimStartRaw);
    const trimEndSec = trimEndRaw == null ? undefined : Number(trimEndRaw);

    const pageNumber = Number(pageNumberRaw);
    const duration = Number(durationRaw) || 0;
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: 'Invalid pageNumber' }, { status: 400 });
    }
    if (
      (trimStartSec != null && !Number.isFinite(trimStartSec))
      || (trimEndSec != null && !Number.isFinite(trimEndSec))
      || (trimStartSec != null && trimEndSec != null && trimEndSec <= trimStartSec)
    ) {
      return NextResponse.json({ error: 'Invalid trim range' }, { status: 400 });
    }
    if (!audioFile) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, project_type, canvas_state')
      .eq('id', projectId)
      .single();
    if (projectError || !project) {
      return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (project.project_type !== 'chapter_book') {
      return NextResponse.json({ error: 'Not a chapter book' }, { status: 400 });
    }

    const pages = docToPages(project.canvas_state as any);
    const page = pages.find((p) => p.pageNumber === pageNumber);
    if (!page) {
      return NextResponse.json(
        { error: `Page ${pageNumber} not found (chapter book has ${pages.length} pages)` },
        { status: 404 }
      );
    }
    const contentHash = hashPageContent(page.plainText);

    // Get or create voice profile (mirrors picture-book upload-user-audio).
    let voiceProfile;
    const { data: existingProfile } = await supabase
      .from('voice_profiles')
      .select('*')
      .eq('user_id', user.id)
      .eq('profile_name', voiceProfileName)
      .eq('profile_type', 'user_recorded')
      .single();
    if (existingProfile) {
      voiceProfile = existingProfile;
    } else {
      const { data: newProfile, error: profileError } = await supabase
        .from('voice_profiles')
        .insert({
          user_id: user.id,
          profile_name: voiceProfileName,
          profile_type: 'user_recorded',
          voice_owner: 'parent',
        })
        .select()
        .single();
      if (profileError || !newProfile) {
        return NextResponse.json({ error: 'Failed to create voice profile' }, { status: 500 });
      }
      voiceProfile = newProfile;
    }

    let uploadResult;
    try {
      uploadResult = await processAndUploadRecording({
        supabase,
        projectId,
        pageNumber,
        audioFile,
        trimStartSec,
        trimEndSec,
      });
    } catch (uploadError: any) {
      return NextResponse.json(
        { error: uploadError.message || 'Upload failed' },
        { status: 500 }
      );
    }

    const audioUrlField = language === 'en' ? 'audio_url' : 'audio_url_secondary';
    const { data: existing } = await supabase
      .from('story_audio_pages')
      .select('id, recording_metadata, audio_url, audio_url_secondary, language')
      .eq('project_id', projectId)
      .eq('page_number', pageNumber)
      .maybeSingle();

    let audioPageId: string;
    if (existing) {
      const updateData: Record<string, any> = {
        [audioUrlField]: uploadResult.audioUrl,
        audio_source: 'user_recorded',
        voice_profile_id: voiceProfile.id,
        recorded_by_user_id: user.id,
        text_content: page.plainText,
        content_hash: contentHash,
        generation_status: 'completed',
        // Replacing with a fresh take wipes any prior layer composition so
        // the new vocal isn't overlaid with stale effects positioned for the
        // old timing. SFX added in the new recording session will be
        // re-applied by the post-upload PATCH /layers call.
        audio_layers: null,
        recording_metadata: {
          ...((existing as any).recording_metadata || {}),
          [`${language}_recording`]: {
            original_filename: audioFile.name,
            file_size_bytes: uploadResult.fileSizeBytes,
            mime_type: uploadResult.contentType,
            duration_seconds: duration,
            uploaded_at: new Date().toISOString(),
          },
        },
        audio_duration_seconds: duration,
      };
      if (language === 'en') {
        updateData.audio_filename = uploadResult.storagePath;
      }
      const { error: updateError } = await supabase
        .from('story_audio_pages')
        .update(updateData)
        .eq('id', existing.id);
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }
      audioPageId = existing.id;
    } else {
      const insertData: Record<string, any> = {
        project_id: projectId,
        page_number: pageNumber,
        page_type: 'chapter_page',
        text_content: page.plainText,
        content_hash: contentHash,
        [audioUrlField]: uploadResult.audioUrl,
        audio_source: 'user_recorded',
        voice_profile_id: voiceProfile.id,
        recorded_by_user_id: user.id,
        language,
        generation_status: 'completed',
        audio_duration_seconds: duration,
        recording_metadata: {
          original_filename: audioFile.name,
          file_size_bytes: uploadResult.fileSizeBytes,
          mime_type: uploadResult.contentType,
          duration_seconds: duration,
          uploaded_at: new Date().toISOString(),
        },
      };
      if (language === 'en') {
        insertData.audio_filename = uploadResult.storagePath;
      }
      const { data: inserted, error: insertError } = await supabase
        .from('story_audio_pages')
        .insert(insertData)
        .select('id')
        .single();
      if (insertError || !inserted) {
        return NextResponse.json({ error: insertError?.message || 'Insert failed' }, { status: 500 });
      }
      audioPageId = inserted.id;
    }

    return NextResponse.json({
      success: true,
      audioPageId,
      audioUrl: uploadResult.audioUrl,
      contentHash,
      voiceProfileId: voiceProfile.id,
    });
  } catch (error: any) {
    console.error('chapter-book upload-user-audio error:', error);
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
