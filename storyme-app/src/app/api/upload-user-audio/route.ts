/**
 * Upload User-Recorded Audio API
 * Handles user voice recordings for story narration
 * Supports direct recording (immediate) and voice cloning (future)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processAndUploadRecording } from '@/lib/audio/upload-recording.service';

// Maximum duration for this API route (5 minutes for multiple uploads - Vercel Hobby limit)
export const maxDuration = 300;

interface AudioUpload {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  sceneId?: string;
  quizQuestionId?: string;
  textContent: string;
  duration: number;
  /** Optional FFmpeg trim window applied before storage upload. */
  trimStartSec?: number;
  trimEndSec?: number;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('projectId') as string;
    const language = formData.get('language') as string || 'en';
    const voiceProfileName = formData.get('voiceProfileName') as string || 'User Voice';

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    console.log(`🎙️ Processing user audio upload for project: ${projectId}`);

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

    // Verify user owns the project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, title, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      console.error('Project verification error:', projectError);
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get or create voice profile
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
      console.log(`Using existing voice profile: ${voiceProfile.id}`);
    } else {
      // Create new voice profile
      const { data: newProfile, error: profileError } = await supabase
        .from('voice_profiles')
        .insert({
          user_id: user.id,
          profile_name: voiceProfileName,
          profile_type: 'user_recorded',
          voice_owner: 'parent', // Can be customized later
        })
        .select()
        .single();

      if (profileError || !newProfile) {
        console.error('Failed to create voice profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to create voice profile' },
          { status: 500 }
        );
      }

      voiceProfile = newProfile;
      console.log(`Created new voice profile: ${voiceProfile.id}`);
    }

    // Process audio uploads
    const audioMetadataStr = formData.get('audioMetadata') as string;
    if (!audioMetadataStr) {
      return NextResponse.json(
        { error: 'Audio metadata is required' },
        { status: 400 }
      );
    }

    const audioMetadata: AudioUpload[] = JSON.parse(audioMetadataStr);
    const uploadedPages = [];
    const failedPages = [];

    for (const metadata of audioMetadata) {
      try {
        const audioFile = formData.get(`audio_${metadata.pageNumber}`) as File;

        if (!audioFile) {
          console.error(`No audio file found for page ${metadata.pageNumber}`);
          failedPages.push({
            pageNumber: metadata.pageNumber,
            error: 'Audio file missing',
          });
          continue;
        }

        console.log(`📤 Uploading audio for page ${metadata.pageNumber}: ${audioFile.name} (${audioFile.size} bytes)`);

        let uploadResult;
        try {
          uploadResult = await processAndUploadRecording({
            supabase,
            projectId,
            pageNumber: metadata.pageNumber,
            audioFile,
            trimStartSec: metadata.trimStartSec,
            trimEndSec: metadata.trimEndSec,
          });
        } catch (uploadErr: any) {
          console.error(`Upload error for page ${metadata.pageNumber}:`, uploadErr);
          failedPages.push({
            pageNumber: metadata.pageNumber,
            error: uploadErr.message || 'Upload failed',
          });
          continue;
        }
        const publicUrl = uploadResult.audioUrl;
        const filename = uploadResult.storagePath;

        // Check if page already exists
        const { data: existingPage } = await supabase
          .from('story_audio_pages')
          .select('*')
          .eq('project_id', projectId)
          .eq('page_number', metadata.pageNumber)
          .single();

        // Determine which field to update based on language.
        // EN goes to audio_url; any non-EN secondary language (zh/ko/etc.) goes to
        // audio_url_secondary, mirroring the AI generation pipeline (see
        // generate-story-audio/route.ts). Legacy audio_url_zh column is no longer
        // written to from the recording flow.
        const audioUrlField = language === 'en' ? 'audio_url' : 'audio_url_secondary';
        // Note: audio_filename column is shared (no per-language variants)

        let audioPage;
        let error: any;

        if (existingPage) {
          // UPDATE existing page - add bilingual audio without deleting the other language
          const updateData: any = {
            [audioUrlField]: publicUrl,
            audio_source: 'user_recorded',
            voice_profile_id: voiceProfile.id,
            recorded_by_user_id: user.id,
            // Keep original language if both EN and secondary recordings exist
            language: existingPage.audio_url && existingPage.audio_url_secondary ? existingPage.language : language,
            generation_status: 'completed',
            // Re-recording invalidates any prior layer composition (effect
            // timings were authored against the old vocal). Recorder's
            // post-upload PATCH /layers will re-apply current effects if any.
            audio_layers: null,
            recording_metadata: {
              ...(existingPage.recording_metadata || {}),
              [`${language}_recording`]: {
                original_filename: audioFile.name,
                file_size_bytes: audioFile.size,
                mime_type: audioFile.type,
                duration_seconds: metadata.duration,
                uploaded_at: new Date().toISOString(),
                browser: request.headers.get('user-agent')?.substring(0, 100),
              },
            },
          };

          // Only update audio_filename if recording in English (primary language)
          if (language === 'en') {
            updateData.audio_filename = filename;
          }

          const { data, error: updateError } = await supabase
            .from('story_audio_pages')
            .update(updateData)
            .eq('project_id', projectId)
            .eq('page_number', metadata.pageNumber)
            .select()
            .single();

          audioPage = data;
          error = updateError;
        } else {
          // INSERT new page
          const insertData: any = {
            project_id: projectId,
            page_number: metadata.pageNumber,
            page_type: metadata.pageType,
            scene_id: metadata.sceneId || null,
            quiz_question_id: metadata.quizQuestionId || null,
            text_content: metadata.textContent,
            [audioUrlField]: publicUrl,
            audio_source: 'user_recorded',
            voice_profile_id: voiceProfile.id,
            recorded_by_user_id: user.id,
            language: language,
            generation_status: 'completed',
            recording_metadata: {
              original_filename: audioFile.name,
              file_size_bytes: audioFile.size,
              mime_type: audioFile.type,
              duration_seconds: metadata.duration,
              uploaded_at: new Date().toISOString(),
              browser: request.headers.get('user-agent')?.substring(0, 100),
            },
          };

          // Only set audio_filename if recording in English (primary language)
          if (language === 'en') {
            insertData.audio_filename = filename;
          }

          const { data, error: insertError } = await supabase
            .from('story_audio_pages')
            .insert(insertData)
            .select()
            .single();

          audioPage = data;
          error = insertError;
        }

        const insertError = error;

        if (insertError || !audioPage) {
          console.error(`Failed to create audio page record for page ${metadata.pageNumber}:`, insertError);
          failedPages.push({
            pageNumber: metadata.pageNumber,
            error: insertError?.message || 'Database insert failed',
          });
          continue;
        }

        uploadedPages.push(audioPage);
        console.log(`✅ Page ${metadata.pageNumber} uploaded successfully`);

      } catch (pageError: any) {
        console.error(`Error processing page ${metadata.pageNumber}:`, pageError);
        failedPages.push({
          pageNumber: metadata.pageNumber,
          error: pageError.message || 'Unknown error',
        });
      }
    }

    console.log(`🎉 Upload complete. ${uploadedPages.length}/${audioMetadata.length} pages successful`);

    if (failedPages.length > 0) {
      console.error('Failed pages:', failedPages);
    }

    return NextResponse.json({
      success: true,
      message: `Uploaded audio for ${uploadedPages.length} pages`,
      totalPages: audioMetadata.length,
      successfulPages: uploadedPages.length,
      failedPages: failedPages.length > 0 ? failedPages : undefined,
      voiceProfileId: voiceProfile.id,
      audioPages: uploadedPages,
    });

  } catch (error: any) {
    console.error('User audio upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload audio' },
      { status: 500 }
    );
  }
}
