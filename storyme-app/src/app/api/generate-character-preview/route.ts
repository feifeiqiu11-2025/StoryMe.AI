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
import { createClientFromRequest } from '@/lib/supabase/server';
import { logApiUsage, checkImageGenerationLimit } from '@/lib/utils/rate-limit';
import { isArtStyle, type ArtStyleType } from '@/lib/art-styles-config';
import {
  generateCharacterPreview,
  generateCharacterPreviewClassic,
  generateNonHumanPreview,
  generateNonHumanPreviewClassic,
  generateDescriptionOnlyPreview,
  generateDescriptionOnlyPreviewClassic,
  detectSubjectType,
  isGeminiAvailable,
  type ClassicPreviewStyle,
} from '@/lib/gemini-image-client';
import {
  CharacterDescription,
  SubjectType,
  ImageMedium,
  normalizeImageProvider,
  normalizeImageMedium,
  isOpenAIProvider,
} from '@/lib/types/story';
import { resolveGeminiImageModel } from '@/lib/gemini-image-client';

export const maxDuration = 120; // 2 minutes timeout

interface GeneratePreviewRequest {
  name: string;
  referenceImageUrl?: string; // Optional - if not provided, use description-only mode
  characterType?: string; // For description-only mode: "baby eagle", "friendly dragon", etc.
  subjectType?: SubjectType; // Pre-detected subject type from UI (avoids redundant detection)
  subjectDescription?: string; // Pre-detected description from UI
  imageProvider?: string; // Image provider — gemini-3.1 (default), gemini-2.5, openai-gpt-image-2, flux
  medium?: ImageMedium; // Detected medium of reference image (real_photo / kid_creation / digital_art)
  style?: ArtStyleType; // Single style to generate (pixar|classic|ghibli|realistic|coloring). Omitted = legacy both-style.
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
        { error: 'Image generation service is not configured' },
        { status: 503 }
      );
    }

    // Parse request body
    const body: GeneratePreviewRequest = await request.json();
    const { name, referenceImageUrl, characterType, subjectType: preDetectedType, subjectDescription: preDetectedDescription, description, imageProvider: requestedProvider, medium: requestedMedium, style: rawStyle } = body;

    // Single style to render (new Studio flow). Undefined = legacy both-style
    // request (old preview UI still calls it that way until fully migrated).
    const requestedStyle: ArtStyleType | undefined = isArtStyle(rawStyle) ? rawStyle : undefined;

    // Cost cap (R1): preview generation now counts against the per-user image
    // limit — the client-side attempt counter is UX-only and resettable.
    const rateLimit = await checkImageGenerationLimit(user.id, 1);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: rateLimit.reason || 'Image limit reached', limit: true },
        { status: 429 }
      );
    }

    // Normalize provider + medium
    const provider = normalizeImageProvider(requestedProvider);
    const medium = normalizeImageMedium(requestedMedium);

    // Resolve Gemini model ID — only used when provider is Gemini. Harmless when provider is openai
    // (the generation function ignores modelId and delegates to the OpenAI sibling).
    const geminiModelId = isOpenAIProvider(provider)
      ? undefined
      : resolveGeminiImageModel(provider);

    console.log(`[API] Provider: ${provider}, Medium: ${medium}, Style: ${requestedStyle || 'both'}`);

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

    console.log(`[API] Generating character preview for: ${name}, style=${requestedStyle || 'both(legacy)'}`);
    console.log(`[API] Mode: ${isDescriptionOnly ? 'Description Only' : 'With Reference Image'}`);

    let detectedSubjectType: SubjectType = 'human'; // Default for backwards compatibility
    let detectedDescription: string = '';

    // Text description used by description-only generation.
    const descriptionText = [
      description?.otherFeatures,
      description?.age,
      description?.hairColor ? `${description.hairColor} coloring` : null,
    ].filter(Boolean).join(', ');

    // Resolve subject type ONCE (shared by single- and legacy-both paths).
    if (isDescriptionOnly) {
      // Heuristic from characterType; the UI handles isAnimal separately.
      detectedSubjectType = inferSubjectTypeFromDescription(characterType!);
    } else if (preDetectedType) {
      detectedSubjectType = preDetectedType;
      detectedDescription = preDetectedDescription || description?.otherFeatures || '';
      console.log(`[API] Using pre-detected subject type: ${detectedSubjectType} - ${detectedDescription}`);
    } else {
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

    // Single-style generator — dispatches by mode + subject. Pixar uses its
    // dedicated function; classic/ghibli/realistic/coloring reuse the
    // *Classic generators with styleVariant (the storybook-page mechanism).
    type StyleResult = { imageUrl: string; generationTime: number };
    const generateForStyle = async (style: ArtStyleType): Promise<StyleResult> => {
      const isPixar = style === 'pixar';
      const classicStyle = style as ClassicPreviewStyle; // only used on the non-pixar branch
      if (isDescriptionOnly) {
        const descParams = { name: name.trim(), characterType: characterType!, description: descriptionText, modelId: geminiModelId, provider, subjectType: detectedSubjectType };
        const r = isPixar
          ? await generateDescriptionOnlyPreview(descParams)
          : await generateDescriptionOnlyPreviewClassic({ ...descParams, styleVariant: classicStyle });
        return { imageUrl: r.imageUrl, generationTime: r.generationTime };
      }
      if (detectedSubjectType === 'human') {
        const charDescription: CharacterDescription = {
          hairColor: description?.hairColor,
          skinTone: description?.skinTone,
          age: description?.age,
          otherFeatures: description?.otherFeatures,
        };
        const previewParams = { name: name.trim(), referenceImageUrl: referenceImageUrl!, description: charDescription, modelId: geminiModelId, provider, medium };
        const r = isPixar
          ? await generateCharacterPreview(previewParams)
          : await generateCharacterPreviewClassic({ ...previewParams, styleVariant: classicStyle });
        return { imageUrl: r.imageUrl, generationTime: r.generationTime };
      }
      const nonHumanParams = { name: name.trim(), referenceImageUrl: referenceImageUrl!, subjectType: detectedSubjectType, briefDescription: detectedDescription, additionalDetails: description?.otherFeatures, modelId: geminiModelId, provider, medium };
      const r = isPixar
        ? await generateNonHumanPreview(nonHumanParams)
        : await generateNonHumanPreviewClassic({ ...nonHumanParams, styleVariant: classicStyle });
      return { imageUrl: r.imageUrl, generationTime: r.generationTime };
    };

    const logStyle = async (style: string, gen: StyleResult) => {
      await logApiUsage({
        userId: user.id,
        endpoint: `/api/generate-character-preview?provider=${provider}&medium=${medium}&style=${style}&subject=${detectedSubjectType}`,
        method: 'POST',
        statusCode: 200,
        responseTimeMs: Math.round(gen.generationTime * 1000),
        imagesGenerated: 1,
      });
    };

    // NEW single-style path (Character Preview Studio).
    if (requestedStyle) {
      let preview: StyleResult;
      try {
        preview = await generateForStyle(requestedStyle);
      } catch (genErr) {
        console.error(`[API] ${requestedStyle} preview failed:`, genErr);
        return NextResponse.json(
          { error: 'Failed to generate preview', details: genErr instanceof Error ? genErr.message : 'Unknown error' },
          { status: 500 }
        );
      }
      await logStyle(requestedStyle, preview);
      return NextResponse.json({
        success: true,
        preview,
        style: requestedStyle,
        // Back-compat shim for old UI that reads previews.pixar/classic.
        previews: {
          pixar: requestedStyle === 'pixar' ? preview : null,
          classic: requestedStyle === 'pixar' ? null : preview,
        },
        subjectType: detectedSubjectType,
        subjectDescription: detectedDescription,
        provider,
        medium,
        totalTime: (Date.now() - startTime) / 1000,
      });
    }

    // LEGACY both-style path (old preview UI sends no style).
    const [pixarResult, classicResult] = await Promise.allSettled([
      generateForStyle('pixar'),
      generateForStyle('classic'),
    ]);
    const pixar = pixarResult.status === 'fulfilled' ? pixarResult.value : null;
    const classic = classicResult.status === 'fulfilled' ? classicResult.value : null;

    if (pixar) console.log(`[API] 3D Pixar preview generated in ${pixar.generationTime.toFixed(1)}s`);
    else console.error('[API] 3D Pixar preview failed:', (pixarResult as PromiseRejectedResult).reason);
    if (classic) console.log(`[API] Classic preview generated in ${classic.generationTime.toFixed(1)}s`);
    else console.error('[API] Classic preview failed:', (classicResult as PromiseRejectedResult).reason);

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

    if (pixar) await logStyle('pixar', pixar);
    if (classic) await logStyle('classic', classic);

    return NextResponse.json({
      success: true,
      previews: { pixar, classic },
      preview: pixar || classic,
      subjectType: detectedSubjectType,
      subjectDescription: detectedDescription,
      provider,
      medium,
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
