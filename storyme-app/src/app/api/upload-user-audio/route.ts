/**
 * Upload User-Recorded Audio API
 * Handles user voice recordings for story narration
 * Supports direct recording (immediate) and voice cloning (future)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

/**
 * Convert WebM audio buffer to MP3
 * Required for iOS compatibility (iOS doesn't support WebM)
 */
async function convertWebmToMp3(webmBuffer: Buffer): Promise<Buffer> {
  const tempId = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const inputPath = join(tmpdir(), `${tempId}.webm`);
  const outputPath = join(tmpdir(), `${tempId}.mp3`);

  try {
    // Write WebM buffer to temp file
    await writeFile(inputPath, webmBuffer);

    // Convert to MP3
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    // Read MP3 buffer
    const mp3Buffer = await readFile(outputPath);

    return mp3Buffer;
  } finally {
    // Cleanup temp files
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Maximum duration for this API route (5 minutes for multiple uploads - Vercel Hobby limit)
export const maxDuration = 300;

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
        let buffer: Buffer = Buffer.from(arrayBuffer);
        let contentType = audioFile.type;
        let fileExtension = 'mp3'; // Default to MP3 for iOS compatibility

        // Convert WebM to MP3 for iOS compatibility
        if (audioFile.type.includes('webm')) {
          console.log(`🔄 Converting WebM to MP3 for iOS compatibility...`);
          try {
            const mp3Buffer = await convertWebmToMp3(buffer);
            buffer = mp3Buffer;
            contentType = 'audio/mpeg';
            fileExtension = 'mp3';
            console.log(`✅ Conversion complete: ${buffer.length} bytes`);
          } catch (conversionError: any) {
            console.error(`❌ WebM to MP3 conversion failed:`, conversionError);
            // Fall back to original WebM if conversion fails
            fileExtension = 'webm';
            contentType = audioFile.type;
          }
        } else if (audioFile.type.includes('mp4')) {
          fileExtension = 'm4a';
        } else if (audioFile.type.includes('mpeg')) {
          fileExtension = 'mp3';
        }

        // Upload to Supabase storage
        const filename = `${projectId}/user-recorded/page-${metadata.pageNumber}-${Date.now()}.${fileExtension}`;
        const { error: uploadError } = await supabase.storage
          .from('story-audio-files')
          .upload(filename, buffer, {
            contentType: contentType,
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
