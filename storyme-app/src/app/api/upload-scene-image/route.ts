/**
 * API Route: Upload Scene Image
 * POST /api/upload-scene-image
 *
 * Lightweight endpoint that uploads a single base64 image to Supabase Storage
 * and returns the CDN URL. No DB writes — used by the client to convert
 * base64 images to CDN URLs before saving a story.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';

export const maxDuration = 60;

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
    const dataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/png;base64,${imageBase64}`;

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
