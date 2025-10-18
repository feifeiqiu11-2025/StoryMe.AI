/**
 * Regenerate Scene Image API
 *
 * Regenerates a single scene image with a custom or edited prompt.
 * Allows users to refine images that don't meet their expectations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { extractSceneLocation } from '@/lib/scene-parser';
import { Character } from '@/lib/types/story';

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sceneId,
      sceneNumber,
      customPrompt,
      originalSceneDescription,
      characters,
      artStyle,
      sceneLocation,
    } = body;

    // Validate inputs
    if (!sceneId || !sceneNumber) {
      return NextResponse.json(
        { error: 'Scene ID and number are required' },
        { status: 400 }
      );
    }

    if (!customPrompt) {
      return NextResponse.json(
        { error: 'Custom prompt is required' },
        { status: 400 }
      );
    }

    if (!characters || characters.length === 0) {
      return NextResponse.json(
        { error: 'At least one character is required' },
        { status: 400 }
      );
    }

    console.log(`[Regenerate] Scene ${sceneNumber} with custom prompt`);
    console.log(`[Regenerate] Custom prompt: ${customPrompt.substring(0, 100)}...`);

    // Convert relative URLs to absolute URLs for Fal.ai
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3002}`;

    // Prepare character prompt info with absolute URLs
    const characterPrompts: CharacterPromptInfo[] = characters.map((char: Character) => ({
      name: char.name,
      referenceImageUrl: char.referenceImage.url.startsWith('http')
        ? char.referenceImage.url
        : `${baseUrl}${char.referenceImage.url}`,
      description: char.description,
    }));

    // Extract location if not provided
    const location = sceneLocation || extractSceneLocation(customPrompt);

    console.log(`[Regenerate] Scene location: ${location}`);
    console.log(`[Regenerate] Characters: ${characterPrompts.map(c => c.name).join(', ')}`);

    // Generate the image
    const startTime = Date.now();
    const result = await generateImageWithMultipleCharacters({
      characters: characterPrompts,
      sceneDescription: customPrompt, // Use the custom prompt
      artStyle: artStyle || "children's book illustration, colorful, whimsical",
      sceneLocation: location,
      emphasizeGenericCharacters: true,
    });
    const generationTime = (Date.now() - startTime) / 1000;

    console.log(`[Regenerate] ✓ Scene ${sceneNumber} completed in ${generationTime}s`);

    // Return the new image data
    return NextResponse.json({
      success: true,
      generatedImage: {
        id: sceneId, // Keep the same ID to replace existing
        sceneNumber,
        sceneDescription: originalSceneDescription, // Keep original description
        imageUrl: result.imageUrl,
        prompt: customPrompt, // Store the custom prompt that was used
        generationTime,
        status: 'completed',
      },
    });

  } catch (error) {
    console.error('[Regenerate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to regenerate image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
