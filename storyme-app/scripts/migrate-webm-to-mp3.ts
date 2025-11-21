/**
 * Batch Migration Script: Convert WebM audio files to MP3
 *
 * This script converts all historical .webm audio files to .mp3 format
 * for iOS compatibility in the KindleWood Kids app.
 *
 * Usage:
 *   npx ts-node scripts/migrate-webm-to-mp3.ts
 *
 * Or add to package.json scripts:
 *   "migrate-audio": "ts-node scripts/migrate-webm-to-mp3.ts"
 */

import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Environment variables - set these before running
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Convert WebM buffer to MP3
 */
async function convertWebmToMp3(webmBuffer: Buffer): Promise<Buffer> {
  const tempId = `migrate-${Date.now()}-${Math.random().toString(36).substring(7)}`;
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
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    const mp3Buffer = await readFile(outputPath);
    return mp3Buffer;
  } finally {
    try {
      await unlink(inputPath);
      await unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Download file from Supabase storage
 */
async function downloadFile(filePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from('story-audio-files')
    .download(filePath);

  if (error || !data) {
    throw new Error(`Failed to download ${filePath}: ${error?.message}`);
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Upload file to Supabase storage
 */
async function uploadFile(filePath: string, buffer: Buffer, contentType: string): Promise<string> {
  const { error } = await supabase.storage
    .from('story-audio-files')
    .upload(filePath, buffer, {
      contentType,
      upsert: true, // Overwrite if exists
    });

  if (error) {
    throw new Error(`Failed to upload ${filePath}: ${error.message}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('story-audio-files')
    .getPublicUrl(filePath);

  return publicUrl;
}

/**
 * Main migration function
 */
async function migrateWebmToMp3() {
  console.log('🚀 Starting WebM to MP3 migration...\n');

  // Find all audio pages with .webm files
  const { data: audioPages, error } = await supabase
    .from('story_audio_pages')
    .select('id, project_id, page_number, audio_url, audio_filename')
    .like('audio_url', '%.webm');

  if (error) {
    console.error('❌ Failed to fetch audio pages:', error);
    process.exit(1);
  }

  if (!audioPages || audioPages.length === 0) {
    console.log('✅ No WebM files found. Migration complete!');
    return;
  }

  console.log(`📋 Found ${audioPages.length} WebM files to convert\n`);

  let successCount = 0;
  let failCount = 0;

  for (const page of audioPages) {
    try {
      console.log(`\n🔄 Processing: ${page.audio_filename}`);
      console.log(`   Project: ${page.project_id}, Page: ${page.page_number}`);

      // Download WebM file
      console.log('   📥 Downloading...');
      const webmBuffer = await downloadFile(page.audio_filename);
      console.log(`   📦 Downloaded ${webmBuffer.length} bytes`);

      // Convert to MP3
      console.log('   🔄 Converting to MP3...');
      const mp3Buffer = await convertWebmToMp3(webmBuffer);
      console.log(`   ✅ Converted to ${mp3Buffer.length} bytes`);

      // Generate new filename (replace .webm with .mp3)
      const mp3Filename = page.audio_filename.replace('.webm', '.mp3');

      // Upload MP3 file
      console.log('   📤 Uploading MP3...');
      const mp3Url = await uploadFile(mp3Filename, mp3Buffer, 'audio/mpeg');
      console.log(`   ✅ Uploaded: ${mp3Filename}`);

      // Update database record
      const { error: updateError } = await supabase
        .from('story_audio_pages')
        .update({
          audio_url: mp3Url,
          audio_filename: mp3Filename,
        })
        .eq('id', page.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      console.log(`   ✅ Database updated`);

      // Optionally delete old WebM file
      const { error: deleteError } = await supabase.storage
        .from('story-audio-files')
        .remove([page.audio_filename]);

      if (deleteError) {
        console.log(`   ⚠️ Could not delete old WebM (non-critical): ${deleteError.message}`);
      } else {
        console.log(`   🗑️ Deleted old WebM file`);
      }

      successCount++;
      console.log(`   ✅ Page ${page.page_number} migrated successfully!`);

    } catch (err: any) {
      failCount++;
      console.error(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successful: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`   📋 Total: ${audioPages.length}`);
  console.log('='.repeat(50));

  if (failCount > 0) {
    console.log('\n⚠️ Some files failed to migrate. Please check the errors above.');
  } else {
    console.log('\n🎉 All files migrated successfully!');
  }
}

// Run migration
migrateWebmToMp3().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
