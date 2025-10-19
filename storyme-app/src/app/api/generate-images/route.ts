import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { parseScriptIntoScenes, buildConsistentSceneSettings, extractSceneLocation } from '@/lib/scene-parser';
import { GeneratedImage, Character, CharacterRating } from '@/lib/types/story';
import { createClient } from '@/lib/supabase/server';
import { checkImageGenerationLimit, logApiUsage } from '@/lib/utils/rate-limit';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    const body = await request.json();
    const { characters, script, artStyle } = body;

    // Validate inputs
    if (!characters || characters.length === 0) {
      return NextResponse.json(
        { error: 'At least one character is required' },
        { status: 400 }
      );
    }

    if (!script) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    // Parse script into scenes with character detection
    const scenes = parseScriptIntoScenes(script, characters);

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: 'No valid scenes found in script' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check rate limits BEFORE generating images
    const rateLimitCheck = await checkImageGenerationLimit(user.id, scenes.length);

    if (!rateLimitCheck.allowed) {
      // Log the rate limit hit
      await logApiUsage({
        userId: user.id,
        endpoint: '/api/generate-images',
        method: 'POST',
        statusCode: 429,
        responseTimeMs: Date.now() - startTime,
        errorMessage: rateLimitCheck.reason,
        requestId,
      });

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: rateLimitCheck.reason,
          limits: rateLimitCheck.limits,
        },
        { status: 429 }
      );
    }

    // Generate images for each scene
    const generatedImages: GeneratedImage[] = [];
    const errors: string[] = [];

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

    // Build consistent scene settings
    const sceneSettings = buildConsistentSceneSettings(scenes);
    console.log('Scene settings for consistency:', Array.from(sceneSettings.entries()));

    for (const scene of scenes) {
      try {
        console.log(`Generating image for scene ${scene.sceneNumber}: ${scene.description}`);
        console.log(`Characters in scene: ${scene.characterNames?.join(', ') || 'all'}`);

        // Extract scene location for consistency
        const sceneLocation = extractSceneLocation(scene.description);
        const locationSetting = sceneLocation ? sceneSettings.get(sceneLocation) : undefined;

        console.log(`Scene location: ${sceneLocation}, Setting: ${locationSetting}`);

        // Filter characters that appear in this scene (or use all if not specified)
        const sceneCharacters = scene.characterNames && scene.characterNames.length > 0
          ? characterPrompts.filter(char => scene.characterNames!.includes(char.name))
          : characterPrompts;

        if (sceneCharacters.length === 0) {
          // If no characters detected, use all available characters
          sceneCharacters.push(...characterPrompts);
        }

        const result = await generateImageWithMultipleCharacters({
          characters: sceneCharacters,
          sceneDescription: scene.description,
          artStyle: artStyle || "children's book illustration, colorful, whimsical",
          sceneLocation: locationSetting,
          emphasizeGenericCharacters: true,
        });

        // Create character ratings array for this scene
        const characterRatings: CharacterRating[] = sceneCharacters.map(char => ({
          characterId: characters.find((c: Character) => c.name === char.name)?.id || '',
          characterName: char.name,
        }));

        const generatedImage: GeneratedImage = {
          id: `img-${scene.id}`,
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          sceneDescription: scene.description,
          imageUrl: result.imageUrl,
          prompt: result.prompt,
          generationTime: result.generationTime,
          status: 'completed',
          characterRatings,
        };

        generatedImages.push(generatedImage);
        console.log(`✓ Scene ${scene.sceneNumber} completed in ${result.generationTime}s`);
      } catch (error) {
        console.error(`✗ Scene ${scene.sceneNumber} failed:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Scene ${scene.sceneNumber}: ${errorMessage}`);

        // Add failed image to results
        generatedImages.push({
          id: `img-${scene.id}`,
          sceneId: scene.id,
          sceneNumber: scene.sceneNumber,
          sceneDescription: scene.description,
          imageUrl: '',
          prompt: scene.description,
          generationTime: 0,
          status: 'failed',
          error: errorMessage,
        });
      }
    }

    // Return results even if some images failed
    const successfulCount = generatedImages.filter(img => img.status === 'completed').length;

    // Log API usage
    await logApiUsage({
      userId: user.id,
      endpoint: '/api/generate-images',
      method: 'POST',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      imagesGenerated: successfulCount,
      errorMessage: errors.length > 0 ? errors.join('; ') : undefined,
      requestId,
    });

    return NextResponse.json({
      success: errors.length === 0,
      generatedImages,
      errors: errors.length > 0 ? errors : undefined,
      totalScenes: scenes.length,
      successfulScenes: successfulCount,
      limits: rateLimitCheck.limits, // Include current limits in response
    });
  } catch (error) {
    console.error('Generate images error:', error);

    // Log error
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      await logApiUsage({
        userId: user.id,
        endpoint: '/api/generate-images',
        method: 'POST',
        statusCode: 500,
        responseTimeMs: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        requestId,
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to generate images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
