import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { parseScriptIntoScenes, buildConsistentSceneSettings, extractSceneLocation } from '@/lib/scene-parser';
import { GeneratedImage, Character, CharacterRating } from '@/lib/types';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
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

    // Generate images for each scene
    const generatedImages: GeneratedImage[] = [];
    const errors: string[] = [];

    // Convert relative URLs to absolute URLs for Fal.ai
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

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
    return NextResponse.json({
      success: errors.length === 0,
      generatedImages,
      errors: errors.length > 0 ? errors : undefined,
      totalScenes: scenes.length,
      successfulScenes: generatedImages.filter(img => img.status === 'completed').length,
    });
  } catch (error) {
    console.error('Generate images error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
