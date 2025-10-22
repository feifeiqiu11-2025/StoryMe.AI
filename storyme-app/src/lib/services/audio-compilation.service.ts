/**
 * Audio Compilation Service
 * Compiles individual scene audio files into a single audiobook MP3 for Spotify publishing
 */

import { SupabaseClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

// Configure FFmpeg binary path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export interface AudioCompilationResult {
  compiledAudioUrl: string;
  duration: number;
  fileSize: number;
}

export class AudioCompilationService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Compile all scene audio files into a single audiobook MP3
   */
  async compileAudiobook(
    projectId: string,
    publicationId: string
  ): Promise<AudioCompilationResult> {
    console.log(`🎵 Starting audiobook compilation for project ${projectId}`);

    // 1. Fetch project and audio pages
    const { data: project, error: projectError } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error('Project not found');
    }

    const { data: audioPages, error: audioPagesError } = await this.supabase
      .from('audio_pages')
      .select('*')
      .eq('project_id', projectId)
      .order('page_number', { ascending: true });

    if (audioPagesError || !audioPages || audioPages.length === 0) {
      throw new Error('No audio pages found');
    }

    console.log(`✓ Found ${audioPages.length} audio pages`);

    // 2. Create temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audiobook-'));
    const audioFilePaths: string[] = [];

    try {
      // 3. Download all audio files to temp directory
      for (const page of audioPages) {
        if (!page.audio_url) {
          console.warn(`⚠️ Page ${page.page_number} has no audio URL, skipping`);
          continue;
        }

        try {
          const response = await fetch(page.audio_url);
          if (!response.ok) {
            throw new Error(`Failed to fetch audio: ${response.statusText}`);
          }
          const buffer = await response.arrayBuffer();
          const filePath = path.join(tempDir, `page-${String(page.page_number).padStart(3, '0')}.mp3`);
          await fs.writeFile(filePath, Buffer.from(buffer));
          audioFilePaths.push(filePath);
          console.log(`✓ Downloaded page ${page.page_number}`);
        } catch (error: any) {
          console.error(`Error downloading page ${page.page_number}:`, error);
          throw new Error(`Failed to download audio for page ${page.page_number}: ${error.message}`);
        }
      }

      if (audioFilePaths.length === 0) {
        throw new Error('No audio files were downloaded successfully');
      }

      console.log(`✓ Downloaded ${audioFilePaths.length} audio files`);

      // 4. Create concat list for ffmpeg
      const concatListPath = path.join(tempDir, 'concat-list.txt');
      const concatContent = audioFilePaths
        .map(filePath => `file '${filePath.replace(/'/g, "'\\''")}'`)
        .join('\n');
      await fs.writeFile(concatListPath, concatContent);

      // 5. Compile using ffmpeg
      const outputPath = path.join(tempDir, 'audiobook.mp3');

      await this.compileWithFfmpeg(concatListPath, outputPath);

      // 6. Get file stats
      const stats = await fs.stat(outputPath);
      const fileBuffer = await fs.readFile(outputPath);

      console.log(`✓ Compiled audiobook: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

      // 7. Upload to Supabase Storage (public bucket)
      const fileName = `audiobooks/${projectId}/${publicationId}.mp3`;
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from('story-audio-files')
        .upload(fileName, fileBuffer, {
          contentType: 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // 8. Get public URL
      const { data: urlData } = this.supabase.storage
        .from('story-audio-files')
        .getPublicUrl(fileName);

      console.log(`✓ Uploaded to: ${urlData.publicUrl}`);

      // 9. Calculate duration using ffprobe
      const duration = await this.getAudioDuration(outputPath);

      console.log(`✓ Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);

      // 10. Cleanup temp files
      await fs.rm(tempDir, { recursive: true, force: true });
      console.log('✓ Cleaned up temp files');

      return {
        compiledAudioUrl: urlData.publicUrl,
        duration: Math.round(duration),
        fileSize: stats.size,
      };

    } catch (error) {
      // Cleanup on error
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  /**
   * Compile audio files using FFmpeg
   */
  private async compileWithFfmpeg(concatListPath: string, outputPath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(concatListPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .audioChannels(2)
        .audioFrequency(44100)
        .on('start', (cmd) => {
          console.log('FFmpeg command:', cmd);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${progress.percent.toFixed(1)}% done`);
          }
        })
        .on('end', () => {
          console.log('✓ Audio compilation complete');
          resolve();
        })
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(new Error(`FFmpeg compilation failed: ${err.message}`));
        })
        .save(outputPath);
    });
  }

  /**
   * Get audio duration using ffprobe
   */
  private async getAudioDuration(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(new Error(`FFprobe error: ${err.message}`));
        } else {
          const duration = metadata.format.duration || 0;
          resolve(duration);
        }
      });
    });
  }
}
