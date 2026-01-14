/**
 * API Route: Generate Character Preview
 * POST /api/generate-character-preview
 *
 * Generates TWO style options for character preview:
 * 1. 3D Pixar - Disney/Pixar CGI style
 * 2. Classic Storybook - 2D illustrated, warm watercolor feel
 *
 * Supports three modes:
 * - With reference image (human): Creates animated version of a human photo
 * - With reference image (non-human): Creates animated version of a drawing/animal/object
 * - Description only: Creates character from text description (for animals, fantasy creatures)
 *
 * For image-based modes, the UI passes the already-detected subject type from /api/analyze-character
 * to avoid redundant detection. If not provided, falls back to detection (backward compatibility).
 *
 * Both styles are generated in parallel for faster response.
 * User can then pick their preferred style.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  generateCharacterPreview,
  generateCharacterPreviewClassic,
  generateNonHumanPreview,
  generateNonHumanPreviewClassic,
  generateDescriptionOnlyPreview,
  generateDescriptionOnlyPreviewClassic,
  detectSubjectType,
  isGeminiAvailable,
} from '@/lib/gemini-image-client';
import { CharacterDescription, SubjectType } from '@/lib/types/story';

export const maxDuration = 120; // 2 minutes timeout

interface GeneratePreviewRequest {
  name: string;
  referenceImageUrl?: string; // Optional - if not provided, use description-only mode
  characterType?: string; // For description-only mode: "baby eagle", "friendly dragon", etc.
  subjectType?: SubjectType; // Pre-detected subject type from UI (avoids redundant detection)
  subjectDescription?: string; // Pre-detected description from UI
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
    const { name, referenceImageUrl, characterType, subjectType: preDetectedType, subjectDescription: preDetectedDescription, description } = body;

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

    let pixarResult: PromiseSettledResult<{ imageUrl: string; generationTime: number; subjectType?: SubjectType }>;
    let classicResult: PromiseSettledResult<{ imageUrl: string; generationTime: number; subjectType?: SubjectType }>;
    let detectedSubjectType: SubjectType = 'human'; // Default for backwards compatibility
    let detectedDescription: string = '';

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

      // For description-only, infer subjectType from characterType
      // This is a simple heuristic - the actual character creation UI handles isAnimal separately
      detectedSubjectType = inferSubjectTypeFromDescription(characterType!);

      // Generate BOTH styles in parallel
      [pixarResult, classicResult] = await Promise.allSettled([
        generateDescriptionOnlyPreview(descParams),
        generateDescriptionOnlyPreviewClassic(descParams),
      ]);
    } else {
      // Reference image mode: use pre-detected subject type from UI if available
      // This avoids redundant AI detection since /api/analyze-character already detected it
      if (preDetectedType) {
        detectedSubjectType = preDetectedType;
        detectedDescription = preDetectedDescription || description?.otherFeatures || '';
        console.log(`[API] Using pre-detected subject type: ${detectedSubjectType} - ${detectedDescription}`);
      } else {
        // Fallback: detect subject type (for backward compatibility or if UI didn't provide it)
        console.log(`[API] Detecting subject type from reference image (fallback)...`);

        try {
          const imageResponse = await fetch(referenceImageUrl!);
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString('base64');
          const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';

          const detection = await detectSubjectType(base64, contentType);
          detectedSubjectType = detection.subjectType;
          detectedDescription = detection.briefDescription;

          console.log(`[API] Detected subject type: ${detectedSubjectType} - ${detectedDescription}`);
        } catch (detectionError) {
          console.warn('[API] Subject detection failed, defaulting to human:', detectionError);
          detectedSubjectType = 'human';
          detectedDescription = 'Detection failed';
        }
      }

      if (detectedSubjectType === 'human') {
        // Human mode: use existing human-focused generation
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

        console.log(`[API] Using human preview generation`);

        // Generate BOTH styles in parallel for faster response
        [pixarResult, classicResult] = await Promise.allSettled([
          generateCharacterPreview(previewParams),
          generateCharacterPreviewClassic(previewParams),
        ]);
      } else {
        // Non-human mode: use flexible generation for animals, creatures, objects, scenery
        const nonHumanParams = {
          name: name.trim(),
          referenceImageUrl: referenceImageUrl!,
          subjectType: detectedSubjectType,
          briefDescription: detectedDescription,
          additionalDetails: description?.otherFeatures,
        };

        console.log(`[API] Using non-human preview generation for ${detectedSubjectType}`);

        // Generate BOTH styles in parallel
        [pixarResult, classicResult] = await Promise.allSettled([
          generateNonHumanPreview(nonHumanParams),
          generateNonHumanPreviewClassic(nonHumanParams),
        ]);
      }
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
      // Return detected subject type so UI can adjust form fields
      subjectType: detectedSubjectType,
      subjectDescription: detectedDescription,
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

/**
 * Infer subject type from character type description (for description-only mode)
 * This is a simple heuristic - the key logic is in detectSubjectType for image mode
 */
function inferSubjectTypeFromDescription(characterType: string): SubjectType {
  const lowerType = characterType.toLowerCase();

  // Check for fantasy/mythical creatures
  const creatureKeywords = [
    'dragon', 'unicorn', 'phoenix', 'fairy', 'mermaid', 'monster', 'alien',
    'robot', 'goblin', 'troll', 'elf', 'dwarf', 'ogre', 'wizard', 'witch',
    'ghost', 'vampire', 'zombie', 'dinosaur', 'magical', 'fantasy', 'mythical',
  ];
  if (creatureKeywords.some(kw => lowerType.includes(kw))) {
    return 'creature';
  }

  // Check for real animals
  const animalKeywords = [
    'dog', 'cat', 'bird', 'fish', 'rabbit', 'bunny', 'horse', 'elephant',
    'lion', 'tiger', 'bear', 'mouse', 'rat', 'hamster', 'guinea pig', 'turtle',
    'frog', 'snake', 'lizard', 'eagle', 'owl', 'duck', 'chicken', 'cow', 'pig',
    'sheep', 'goat', 'deer', 'fox', 'wolf', 'monkey', 'gorilla', 'panda',
    'penguin', 'dolphin', 'whale', 'shark', 'octopus', 'crab', 'butterfly',
    'bee', 'ant', 'spider', 'puppy', 'kitten', 'animal',
  ];
  if (animalKeywords.some(kw => lowerType.includes(kw))) {
    return 'animal';
  }

  // Check for objects
  const objectKeywords = [
    'toy', 'car', 'truck', 'ball', 'book', 'sword', 'wand', 'lamp', 'clock',
    'phone', 'computer', 'cup', 'plate', 'chair', 'table', 'bed', 'door',
  ];
  if (objectKeywords.some(kw => lowerType.includes(kw))) {
    return 'object';
  }

  // Check for scenery
  const sceneryKeywords = [
    'house', 'castle', 'tree', 'forest', 'mountain', 'river', 'lake', 'ocean',
    'beach', 'garden', 'park', 'city', 'building', 'tower', 'bridge', 'road',
  ];
  if (sceneryKeywords.some(kw => lowerType.includes(kw))) {
    return 'scenery';
  }

  // Default to creature for description-only mode (usually used for non-humans)
  return 'creature';
}
