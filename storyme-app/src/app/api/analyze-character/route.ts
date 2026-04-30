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
 * Errors are returned with a structured `code` field so the client can show an
 * accurate message instead of always blaming "rate limited" (the old behavior).
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
 * Resize for analysis: long-edge 4096 preserves detail in busy multi-element kid
 * drawings (each figure stays large enough for Gemini to recognize as a distinct
 * subject). The client already compresses to ≤4096 JPEG q0.9 before upload, so this
 * cap is a no-op for normal flow and only kicks in as a safety net when other
 * upload paths bypass the client compression. Token headroom is huge (~0.01% of
 * TPM at typical volume), so the larger cap costs us nothing.
 */
async function resizeForAnalysis(imageBuffer: Buffer): Promise<{ buffer: Buffer; mimeType: string }> {
  const resized = await sharp(imageBuffer)
    .rotate() // honor EXIF orientation
    .resize(4096, 4096, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  return { buffer: resized, mimeType: 'image/jpeg' };
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication (supports both cookie-based and Bearer token auth)
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Check if Gemini is available
    if (!isGeminiAvailable()) {
      return NextResponse.json(
        { error: 'Image analysis service is not configured', code: 'SERVICE_UNCONFIGURED' },
        { status: 503 }
      );
    }

    // Parse request body
    const body: AnalyzeCharacterRequest = await request.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Image URL is required', code: 'MISSING_IMAGE_URL' },
        { status: 400 }
      );
    }

    console.log(`[API] Analyzing character image...`);

    // Fetch image
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl);
    } catch (fetchErr) {
      console.error('[API] Image fetch threw:', fetchErr);
      return NextResponse.json(
        {
          error: 'Failed to fetch image from storage',
          code: 'FETCH_IMAGE_FAILED',
          details: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
        },
        { status: 502 }
      );
    }
    if (!imageResponse.ok) {
      console.error(`[API] Image fetch returned ${imageResponse.status} for ${imageUrl}`);
      return NextResponse.json(
        { error: `Failed to fetch image (HTTP ${imageResponse.status})`, code: 'FETCH_IMAGE_FAILED' },
        { status: 502 }
      );
    }

    const originalBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Resize before sending to Gemini. If sharp can't decode (rare now that the client
    // always re-encodes to JPEG, but defensive), fail fast instead of forwarding bad
    // bytes with a fake mime type — that path silently broke analysis for HEIC uploads.
    let resizedBuffer: Buffer;
    let mimeType: string;
    try {
      const result = await resizeForAnalysis(originalBuffer);
      resizedBuffer = result.buffer;
      mimeType = result.mimeType;
    } catch (sharpErr) {
      console.error('[API] Sharp resize failed:', sharpErr);
      return NextResponse.json(
        {
          error: "Couldn't process this image. Please try a different photo.",
          code: 'SHARP_FAILED',
          details: sharpErr instanceof Error ? sharpErr.message : String(sharpErr),
        },
        { status: 422 }
      );
    }
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
    const errorClass = error instanceof Error ? error.constructor.name : typeof error;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[API] Analyze character error [${errorClass}]:`, errorMessage);

    // Genuine 429s only — drop the bare 'quota' substring match (it caught unrelated
    // errors like "API key not valid for this quota project" and mislabeled them).
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      return NextResponse.json(
        {
          error: 'Image analysis is rate-limited right now. Please pick whether this is a real photo or a kid\'s creation.',
          code: 'RATE_LIMITED',
          retryable: true,
        },
        { status: 429 }
      );
    }

    // Gemini SDK responses with no candidates / parse failures bubble up here.
    if (errorMessage.includes('JSON') || errorMessage.includes('parse')) {
      return NextResponse.json(
        { error: 'Failed to parse analysis response', code: 'GEMINI_PARSE_FAILED', details: errorMessage },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze character image',
        code: 'ANALYSIS_FAILED',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
