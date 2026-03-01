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

export const maxDuration = 30; // 30 seconds timeout

interface AnalyzeCharacterRequest {
  imageUrl: string;
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

    // Fetch image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.status}`);
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

    // Call unified Gemini analysis
    const analysis = await analyzeCharacterImage(base64, contentType);

    console.log(`[API] Analysis complete: ${analysis.subjectType} (confidence: ${analysis.confidence})`);

    return NextResponse.json({
      success: true,
      ...analysis,
    });

  } catch (error) {
    console.error('[API] Analyze character error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to analyze character image',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
