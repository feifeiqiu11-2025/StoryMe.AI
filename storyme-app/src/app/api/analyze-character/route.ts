/**
 * API Route: Analyze Character Image (Unified)
 * POST /api/analyze-character
 *
 * Single Gemini call that:
 * 1. Detects subject type (human, animal, creature, object, scenery)
 * 2. Returns appropriate data based on type:
 *    - Human: Structured fields (gender, hairColor, skinTone, age, clothing, otherFeatures)
 *    - Non-human: Brief description text
 *
 * This replaces both /api/analyze-character-image (GPT) and /api/detect-subject-type (Gemini)
 * Benefits: Single API call (~1-2s vs ~3-5s), no fallback logic, consistent results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { analyzeCharacterImage, isGeminiAvailable } from '@/lib/gemini-image-client';
import sharp from 'sharp';

export const maxDuration = 30; // 30 seconds timeout

interface AnalyzeCharacterRequest {
  imageUrl: string;
}

/**
 * Prepare image for Gemini: keep full dimensions (so small elements in
 * multi-element kid drawings remain analyzable), but compress aggressively
 * to keep upload fast and stay well under Gemini's 7MB-per-request inline
 * data limit. Cap at 4096px only as a safety guard against absurdly large
 * inputs. Token usage is dimension-based, so the retry logic handles rare
 * 429 throttles instead of us downscaling away detail.
 */
async function resizeForAnalysis(imageBuffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  try {
    const resized = await sharp(imageBuffer)
      .rotate() // honor EXIF orientation
      .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return { buffer: resized, mimeType: 'image/jpeg' };
  } catch (err) {
    // If sharp fails (e.g. unsupported format), fall back to the original.
    console.warn('[API] Sharp resize failed, sending original:', err instanceof Error ? err.message : err);
    return { buffer: imageBuffer, mimeType: 'image/jpeg' };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (supports both cookie-based and Bearer token auth)
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if Gemini is available
    if (!isGeminiAvailable()) {
      return NextResponse.json(
        { error: 'Image analysis service is not configured' },
        { status: 503 }
      );
    }

    // Parse request body
    const body: AnalyzeCharacterRequest = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Analyzing character image...`);

    // Fetch image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    // Resize before sending to Gemini — drops token usage ~5-10x on large iPhone photos
    const originalBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const { buffer: resizedBuffer, mimeType } = await resizeForAnalysis(originalBuffer);
    console.log(`[API] Image: ${originalBuffer.length} bytes → ${resizedBuffer.length} bytes (${Math.round(resizedBuffer.length / originalBuffer.length * 100)}%)`);

    const base64 = resizedBuffer.toString('base64');

    // Call unified Gemini analysis (with internal retry on 429)
    const analysis = await analyzeCharacterImage(base64, mimeType);

    console.log(`[API] Analysis complete: ${analysis.subjectType} / medium=${analysis.medium} (confidence: ${analysis.confidence})`);

    return NextResponse.json({
      success: true,
      ...analysis,
    });

  } catch (error) {
    console.error('[API] Analyze character error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Surface rate-limit errors with proper status so the UI can prompt the user
    // to pick medium manually instead of silently treating it as a successful analysis.
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
      return NextResponse.json(
        {
          error: 'Image analysis is rate-limited right now. Please pick whether this is a real photo or a kid\'s creation.',
          code: 'RATE_LIMITED',
          retryable: true,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze character image',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
