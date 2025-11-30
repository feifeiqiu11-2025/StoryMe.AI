/**
 * API Route: Generate Character Preview
 * POST /api/generate-character-preview
 *
 * Generates TWO style options for character preview:
 * 1. 3D Pixar - Disney/Pixar CGI style
 * 2. Classic Storybook - 2D illustrated, warm watercolor feel
 *
 * Supports two modes:
 * - With reference image: Creates animated version of a photo (for human characters)
 * - Description only: Creates character from text description (for animals, fantasy creatures)
 *
 * Both styles are generated in parallel for faster response.
 * User can then pick their preferred style.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateCharacterPreview,
  generateCharacterPreviewClassic,
  generateDescriptionOnlyPreview,
  generateDescriptionOnlyPreviewClassic,
  isGeminiAvailable,
} from '@/lib/gemini-image-client';
import { CharacterDescription } from '@/lib/types/story';

export const maxDuration = 120; // 2 minutes timeout

interface GeneratePreviewRequest {
  name: string;
  referenceImageUrl?: string; // Optional - if not provided, use description-only mode
  characterType?: string; // For description-only mode: "baby eagle", "friendly dragon", etc.
  description: {
    hairColor?: string;
    skinTone?: string;
    age?: string;
    otherFeatures?: string;
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Check authentication
    const supabase = await createClient();
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
        { error: 'Image generation service is not configured' },
        { status: 503 }
      );
    }

    // Parse request body
    const body: GeneratePreviewRequest = await request.json();
    const { name, referenceImageUrl, characterType, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Character name is required' },
        { status: 400 }
      );
    }

    // Determine generation mode
    const isDescriptionOnly = !referenceImageUrl;

    // For description-only mode, we need a character type
    if (isDescriptionOnly && !characterType) {
      return NextResponse.json(
        { error: 'Character type is required when no reference image is provided' },
        { status: 400 }
      );
    }

    console.log(`[API] Generating character previews (both styles) for: ${name}`);
    console.log(`[API] Mode: ${isDescriptionOnly ? 'Description Only' : 'With Reference Image'}`);

    let pixarResult: PromiseSettledResult<{ imageUrl: string; generationTime: number }>;
    let classicResult: PromiseSettledResult<{ imageUrl: string; generationTime: number }>;

    if (isDescriptionOnly) {
      // Description-only mode: generate from text description (for animals, fantasy characters)
      const descriptionText = [
        description?.otherFeatures,
        description?.age,
        description?.hairColor ? `${description.hairColor} coloring` : null,
      ].filter(Boolean).join(', ') || 'cute and friendly';

      const descParams = {
        name: name.trim(),
        characterType: characterType!,
        description: descriptionText,
      };

      console.log(`[API] Generating from description: ${characterType} - ${descriptionText}`);

      // Generate BOTH styles in parallel
      [pixarResult, classicResult] = await Promise.allSettled([
        generateDescriptionOnlyPreview(descParams),
        generateDescriptionOnlyPreviewClassic(descParams),
      ]);
    } else {
      // Reference image mode: generate animated version of photo (for human characters)
      const charDescription: CharacterDescription = {
        hairColor: description?.hairColor,
        skinTone: description?.skinTone,
        age: description?.age,
        otherFeatures: description?.otherFeatures,
      };

      const previewParams = {
        name: name.trim(),
        referenceImageUrl: referenceImageUrl!,
        description: charDescription,
      };

      // Generate BOTH styles in parallel for faster response
      [pixarResult, classicResult] = await Promise.allSettled([
        generateCharacterPreview(previewParams),
        generateCharacterPreviewClassic(previewParams),
      ]);
    }

    // Extract results, handling any failures gracefully
    const pixar = pixarResult.status === 'fulfilled' ? {
      imageUrl: pixarResult.value.imageUrl,
      generationTime: pixarResult.value.generationTime,
    } : null;

    const classic = classicResult.status === 'fulfilled' ? {
      imageUrl: classicResult.value.imageUrl,
      generationTime: classicResult.value.generationTime,
    } : null;

    // Log results
    if (pixar) {
      console.log(`[API] 3D Pixar preview generated in ${pixar.generationTime.toFixed(1)}s`);
    } else {
      console.error('[API] 3D Pixar preview failed:', (pixarResult as PromiseRejectedResult).reason);
    }

    if (classic) {
      console.log(`[API] Classic Storybook preview generated in ${classic.generationTime.toFixed(1)}s`);
    } else {
      console.error('[API] Classic Storybook preview failed:', (classicResult as PromiseRejectedResult).reason);
    }

    // If both failed, return error
    if (!pixar && !classic) {
      return NextResponse.json(
        {
          error: 'Failed to generate any preview styles',
          details: {
            pixar: (pixarResult as PromiseRejectedResult).reason?.message,
            classic: (classicResult as PromiseRejectedResult).reason?.message,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      previews: {
        pixar,
        classic,
      },
      // Keep backward compatibility - return first successful preview as "preview"
      preview: pixar || classic,
      totalTime: (Date.now() - startTime) / 1000,
    });

  } catch (error) {
    console.error('[API] Generate character preview error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for rate limit errors
    if (errorMessage.includes('429') || errorMessage.includes('quota')) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. Please wait a moment and try again.',
          retryable: true,
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to generate character preview',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
