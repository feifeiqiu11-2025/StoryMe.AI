/**
 * API Route: Upload Scene Image
 * POST /api/upload-scene-image
 *
 * Lightweight endpoint that uploads a single base64 image to Supabase Storage
 * and returns the CDN URL. No DB writes — used by the client to convert
 * base64 images to CDN URLs before saving a story.
 */

import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';

export const maxDuration = 60;

// Base64 images larger than this (decoded) get re-encoded to JPEG before upload.
// OpenAI gpt-image returns multi-MB lossless PNGs that were failing the save step;
// smaller images (e.g. Gemini) fall under the threshold and pass through unchanged.
// JPEG (not WebP) because the create-flow storybook PDF uses @react-pdf, which only
// decodes PNG/JPEG — a WebP scene image renders blank in the exported PDF.
const COMPRESS_THRESHOLD_BYTES = 1_500_000;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { imageBase64, folderPath, sceneId } = body as {
      imageBase64: string;
      folderPath: string;
      sceneId: string;
    };

    if (!imageBase64 || !sceneId) {
      return NextResponse.json(
        { error: 'imageBase64 and sceneId are required' },
        { status: 400 }
      );
    }

    const storageService = new StorageService(supabase);

    // Ensure the base64 has the data URL prefix
    let dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

    // Compress large images (e.g. OpenAI gpt-image PNGs) to JPEG before upload.
    // This is what was failing the save with a 500 for big payloads. Small images
    // skip this entirely, so other providers' save behavior is unchanged.
    const parsed = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (parsed) {
      const buf = Buffer.from(parsed[2], 'base64');
      if (buf.length > COMPRESS_THRESHOLD_BYTES) {
        try {
          const jpeg = await sharp(buf)
            .resize(1536, 1536, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer();
          dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`;
          console.log(`[UPLOAD-SCENE-IMAGE] Compressed ${(buf.length / 1024 / 1024).toFixed(1)}MB → ${(jpeg.length / 1024 / 1024).toFixed(1)}MB JPEG for scene ${sceneId}`);
        } catch (compressErr) {
          console.warn('[UPLOAD-SCENE-IMAGE] Compression failed, uploading original:', compressErr instanceof Error ? compressErr.message : compressErr);
        }
      }
    }

    const result = await storageService.uploadGeneratedImageFromBase64(
      folderPath || `user-${user.id}`,
      sceneId,
      dataUrl
    );

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('[UPLOAD-SCENE-IMAGE] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
