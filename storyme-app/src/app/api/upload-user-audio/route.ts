/**
 * Upload User-Recorded Audio API
 * Handles user voice recordings for story narration
 * Supports direct recording (immediate) and voice cloning (future)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Maximum duration for this API route (10 minutes for multiple uploads)
export const maxDuration = 600;

interface AudioUpload {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  sceneId?: string;
  quizQuestionId?: string;
  textContent: string;
  duration: number;
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

        // Convert File to Buffer
        const arrayBuffer = await audioFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine file extension from MIME type
        const fileExtension = audioFile.type.includes('webm') ? 'webm' :
                             audioFile.type.includes('mp4') ? 'm4a' :
                             audioFile.type.includes('mpeg') ? 'mp3' :
                             'webm'; // Default

        // Upload to Supabase storage
        const filename = `${projectId}/user-recorded/page-${metadata.pageNumber}-${Date.now()}.${fileExtension}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('story-audio-files')
          .upload(filename, buffer, {
            contentType: audioFile.type,
            upsert: false, // Don't overwrite, create new files
          });

        if (uploadError) {
          console.error(`Upload error for page ${metadata.pageNumber}:`, uploadError);
          failedPages.push({
            pageNumber: metadata.pageNumber,
            error: uploadError.message,
          });
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('story-audio-files')
          .getPublicUrl(filename);

        // Delete existing audio page for this page number and language (if any)
        await supabase
          .from('story_audio_pages')
          .delete()
          .eq('project_id', projectId)
          .eq('page_number', metadata.pageNumber)
          .eq('language', language);

        // Insert new audio page record
        const { data: audioPage, error: insertError } = await supabase
          .from('story_audio_pages')
          .insert({
            project_id: projectId,
            page_number: metadata.pageNumber,
            page_type: metadata.pageType,
            scene_id: metadata.sceneId || null,
            quiz_question_id: metadata.quizQuestionId || null,
            text_content: metadata.textContent,
            audio_url: publicUrl,
            audio_filename: filename,
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
          })
          .select()
          .single();

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
