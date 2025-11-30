/**
 * Test Gemini Image Generation API
 *
 * POST /api/test-gemini
 * Body: { sceneDescription: string, characterImageUrl?: string }
 *
 * Returns: { success: true, imageUrl: string } or { success: false, error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const maxDuration = 120; // 2 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sceneDescription, characterImageUrl, characterName = 'Child' } = body;

    if (!sceneDescription) {
      return NextResponse.json(
        { success: false, error: 'sceneDescription is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'GEMINI_API_KEY not configured' },
        { status: 500 }
      );
    }

    console.log('[Test Gemini] Starting generation...');
    console.log('[Test Gemini] Scene:', sceneDescription);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-image',
      generationConfig: {
        // @ts-expect-error - responseModalities is valid but not in types yet
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Build content parts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];

    const prompt = `Generate a children's book illustration, colorful, whimsical, Pixar style image showing:
${sceneDescription}

IMPORTANT RULES:
1. If a character reference photo is provided, match their appearance exactly
2. Characters are HUMAN - do not merge with animals or objects
3. Style: Professional children's book illustration
4. Aspect ratio: 1:1`;

    contentParts.push(prompt);

    // Add character reference image if provided
    if (characterImageUrl) {
      try {
        console.log('[Test Gemini] Fetching character image:', characterImageUrl);
        const imageResponse = await fetch(characterImageUrl);
        if (imageResponse.ok) {
          const arrayBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString('base64');
          const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

          contentParts.push({
            inlineData: {
              mimeType,
              data: base64,
            },
          });
          contentParts.push(`[Reference photo for ${characterName}]`);
          console.log('[Test Gemini] Added character reference image');
        }
      } catch (imgError) {
        console.warn('[Test Gemini] Failed to fetch character image:', imgError);
      }
    }

    const startTime = Date.now();
    const result = await model.generateContent(contentParts);
    const duration = Date.now() - startTime;

    console.log(`[Test Gemini] Generation completed in ${duration}ms`);

    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No candidates in response' },
        { status: 500 }
      );
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      return NextResponse.json(
        { success: false, error: 'No parts in response' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textPart = parts.find((p: any) => p.text);
      return NextResponse.json(
        { success: false, error: `No image generated: ${textPart?.text || 'Unknown reason'}` },
        { status: 500 }
      );
    }

    // Return base64 image as data URL
    const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

    return NextResponse.json({
      success: true,
      imageUrl: imageDataUrl,
      generationTimeMs: duration,
      model: 'gemini-2.5-flash-image',
    });

  } catch (error) {
    console.error('[Test Gemini] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Simple GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    message: 'Gemini Image Test API',
    usage: 'POST with { sceneDescription: string, characterImageUrl?: string }',
    example: {
      sceneDescription: 'A happy child playing on a swing at a sunny park',
      characterImageUrl: 'https://your-domain.com/uploads/character-image.jpg',
    },
  });
}
