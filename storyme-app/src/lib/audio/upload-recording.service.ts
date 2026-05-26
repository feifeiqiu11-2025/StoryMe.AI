/**
 * Shared user-recording processing + storage primitive. Used by both picture
 * book and chapter book recording-upload routes.
 *
 * Responsibilities:
 *   - Convert WebM → MP3 via FFmpeg (iOS browsers can't play WebM directly).
 *   - Upload final MP3 (or pass-through MP4/MP3) to `story-audio-files` bucket.
 *
 * Does NOT touch `story_audio_pages` / `voice_profiles` — callers own those
 * writes because picture-book and chapter-book row schemas differ.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { SupabaseClient } from '@supabase/supabase-js';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const STORAGE_BUCKET = 'story-audio-files';

export interface ProcessAndUploadParams {
  supabase: SupabaseClient;
  projectId: string;
  pageNumber: number;
  audioFile: File;
  /** Sub-folder under `{projectId}/`. Default: `user-recorded`. */
  subfolder?: string;
  /** Optional lossless trim window applied via FFmpeg `-ss/-to` after format
      conversion. Trim snaps to MP3 frame boundaries (~26ms) — inaudible but
      worth knowing. When provided, the uploaded file is the trimmed version;
      the untrimmed source is NOT preserved in v1 (re-record to redo). */
  trimStartSec?: number;
  trimEndSec?: number;
}

export interface ProcessAndUploadResult {
  audioUrl: string;
  storagePath: string;
  contentType: string;
  fileExtension: 'mp3' | 'm4a' | 'webm';
  fileSizeBytes: number;
}

async function convertWebmToMp3(webmBuffer: Buffer): Promise<Buffer> {
  const tempId = `audio-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const inputPath = join(tmpdir(), `${tempId}.webm`);
  const outputPath = join(tmpdir(), `${tempId}.mp3`);
  try {
    await writeFile(inputPath, webmBuffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath);
    });
    return await readFile(outputPath);
  } finally {
    try { await unlink(inputPath); } catch { /* ignore */ }
    try { await unlink(outputPath); } catch { /* ignore */ }
  }
}

async function trimMp3(buffer: Buffer, startSec: number, endSec: number): Promise<Buffer> {
  const tempId = `trim-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const inputPath = join(tmpdir(), `${tempId}-in.mp3`);
  const outputPath = join(tmpdir(), `${tempId}-out.mp3`);
  try {
    await writeFile(inputPath, buffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startSec)
        .setDuration(Math.max(0.1, endSec - startSec))
        // -c copy: lossless, snaps to nearest MP3 frame (~26ms imprecision).
        // Re-encoding would be exact but ~10× slower; not worth for v1.
        .audioCodec('copy')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath);
    });
    return await readFile(outputPath);
  } finally {
    try { await unlink(inputPath); } catch { /* ignore */ }
    try { await unlink(outputPath); } catch { /* ignore */ }
  }
}

export async function processAndUploadRecording(
  params: ProcessAndUploadParams,
): Promise<ProcessAndUploadResult> {
  const {
    supabase, projectId, pageNumber, audioFile,
    subfolder = 'user-recorded',
    trimStartSec, trimEndSec,
  } = params;

  const arrayBuffer = await audioFile.arrayBuffer();
  let buffer: Buffer = Buffer.from(arrayBuffer);
  let contentType = audioFile.type;
  let fileExtension: 'mp3' | 'm4a' | 'webm' = 'mp3';

  if (audioFile.type.includes('webm')) {
    try {
      buffer = await convertWebmToMp3(buffer);
      contentType = 'audio/mpeg';
      fileExtension = 'mp3';
    } catch (conversionError) {
      // Fall back to raw WebM if FFmpeg fails — non-iOS clients can still play it.
      console.error('WebM→MP3 conversion failed, falling back to webm:', conversionError);
      fileExtension = 'webm';
      contentType = audioFile.type;
    }
  } else if (audioFile.type.includes('mp4')) {
    fileExtension = 'm4a';
  } else if (audioFile.type.includes('mpeg')) {
    fileExtension = 'mp3';
  }

  // Apply trim after format conversion. Lossless copy only works for MP3 —
  // if conversion fell back to webm, skip trim (rare; non-iOS users only).
  if (
    fileExtension === 'mp3'
    && typeof trimStartSec === 'number'
    && typeof trimEndSec === 'number'
    && trimEndSec > trimStartSec
  ) {
    try {
      buffer = await trimMp3(buffer, trimStartSec, trimEndSec);
    } catch (trimError) {
      console.error('FFmpeg trim failed, uploading untrimmed buffer:', trimError);
      // Non-fatal — upload the untrimmed file. User can re-record if it matters.
    }
  }

  const storagePath = `${projectId}/${subfolder}/page-${pageNumber}-${Date.now()}.${fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  return {
    audioUrl: publicUrl,
    storagePath,
    contentType,
    fileExtension,
    fileSizeBytes: buffer.length,
  };
}
