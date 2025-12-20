/**
 * API Route: Transform Photo to Illustration
 * POST /api/import-photos/transform
 *
 * Transforms a single photo into a children's book illustration
 * and generates an AI caption using Gemini.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { transformPhotoToIllustration } from '@/lib/gemini-image-client';

export const maxDuration = 60; // 60 second timeout per photo

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      imageBase64,
      storyContext,
      illustrationStyle = 'pixar',
      photoIndex,
      totalPhotos,
    } = body;

    // Validate inputs
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Check base64 size (rough estimate: base64 is ~33% larger than binary)
    const estimatedSizeMB = (imageBase64.length * 0.75) / (1024 * 1024);
    if (estimatedSizeMB > 20) {
      return NextResponse.json(
        { error: 'Image is too large. Maximum size is 15MB.' },
        { status: 400 }
      );
    }

    // Validate illustration style
    if (illustrationStyle !== 'pixar' && illustrationStyle !== 'classic') {
      return NextResponse.json(
        { error: 'Invalid illustration style. Must be "pixar" or "classic".' },
        { status: 400 }
      );
    }

    console.log(`📸 Transforming photo ${photoIndex || '?'}/${totalPhotos || '?'} to ${illustrationStyle} style`);
    if (storyContext) {
      console.log(`  Story context: ${storyContext.substring(0, 50)}...`);
    }

    // Transform the photo
    const result = await transformPhotoToIllustration({
      imageBase64,
      storyContext,
      illustrationStyle,
      photoIndex,
      totalPhotos,
    });

    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`✅ Photo transformed in ${totalTime.toFixed(1)}s`);
    console.log(`  Caption: "${result.caption.substring(0, 50)}..."`);

    return NextResponse.json({
      success: true,
      transformedImageBase64: result.transformedImageBase64,
      caption: result.caption,
      generationTime: result.generationTime,
    });

  } catch (error) {
    console.error('Photo transform error:', error);

    // Check for specific error types
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return NextResponse.json(
        {
          error: 'AI service is busy. Please wait a moment and try again.',
          details: 'Rate limit exceeded',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to transform photo',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
