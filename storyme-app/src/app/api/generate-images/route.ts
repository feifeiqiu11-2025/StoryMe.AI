import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { generateImageWithGemini, generateImageWithGeminiClassic, generateImageWithGeminiColoring, isGeminiAvailable, GeminiCharacterInfo, clearOutfitCache } from '@/lib/gemini-image-client';
import { parseScriptIntoScenes, buildConsistentSceneSettings, extractSceneLocation } from '@/lib/scene-parser';
import { GeneratedImage, Character, CharacterRating, ClothingConsistency } from '@/lib/types/story';
import { createClientFromRequest } from '@/lib/supabase/server';
import { checkImageGenerationLimit, logApiUsage } from '@/lib/utils/rate-limit';
import { StorageService } from '@/lib/services/storage.service';

// Image provider type
type ImageProvider = 'flux' | 'gemini';

// Illustration style type
type IllustrationStyle = 'pixar' | 'classic' | 'coloring';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `gen-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    const body = await request.json();
    const {
      characters,
      script,
      artStyle,
      imageProvider: requestedProvider,
      illustrationStyle,
      clothingConsistency: requestedClothingConsistency,
      coverMetadata  // NEW: Cover image metadata (title, description, prompt)
    } = body;

    // Determine clothing consistency mode (default to 'consistent')
    const clothingConsistency: ClothingConsistency = requestedClothingConsistency || 'consistent';
    console.log(`👔 Clothing consistency mode: ${clothingConsistency}`);

    // Clear outfit cache at the start of a new story generation
    // This ensures outfits don't leak between different story sessions
    clearOutfitCache();

    // Determine illustration style (default to 'classic' for 2D storybook)
    const selectedIllustrationStyle: IllustrationStyle = illustrationStyle || 'classic';
    console.log(`🎨 Illustration style: ${selectedIllustrationStyle === 'pixar' ? '3D Pixar' : 'Classic Storybook 2D'}`);

    // Determine which image provider to use
    // Priority: request param > env var > default (flux)
    const defaultProvider = (process.env.IMAGE_PROVIDER as ImageProvider) || 'flux';
    const imageProvider: ImageProvider = requestedProvider || defaultProvider;

    // Validate Gemini is available if requested
    if (imageProvider === 'gemini' && !isGeminiAvailable()) {
      console.warn('Gemini requested but not available, falling back to FLUX');
    }

    const useGemini = imageProvider === 'gemini' && isGeminiAvailable();
    console.log(`🎨 Using image provider: ${useGemini ? 'Gemini' : 'FLUX'}`);


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
    let scenes = parseScriptIntoScenes(script, characters);

    if (scenes.length === 0) {
      return NextResponse.json(
        { error: 'No valid scenes found in script' },
        { status: 400 }
      );
    }

    // NEW: Prepend Scene 0 (cover) if metadata provided
    if (coverMetadata && coverMetadata.title && coverMetadata.coverPrompt) {
      console.log(`📖 Adding cover image (Scene 0): "${coverMetadata.title}"`);

      const coverScene = {
        id: 'cover',
        sceneNumber: 0,
        description: coverMetadata.coverPrompt,
        characterNames: characters.map((c: Character) => c.name)
      };

      // Prepend cover to scenes array
      scenes = [coverScene, ...scenes];
    }

    // Get authenticated user (supports both cookie-based and Bearer token auth)
    const supabase = await createClientFromRequest(request);
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
    // Priority: animated preview (already in illustration style) > reference photo > null
    const characterPrompts: CharacterPromptInfo[] = characters.map((char: Character) => {
      // Determine the best reference image URL
      // Priority: animated preview > reference photo > null
      // Animated preview is preferred because it's already in the target illustration style
      let referenceUrl: string | undefined = undefined;

      if (char.animatedPreviewUrl && char.animatedPreviewUrl.trim()) {
        // Animated preview exists - use it (best for consistency)
        referenceUrl = char.animatedPreviewUrl.startsWith('http')
          ? char.animatedPreviewUrl
          : `${baseUrl}${char.animatedPreviewUrl}`;
        console.log(`[Character] ${char.name}: Using animated preview for reference`);
      } else if (char.referenceImage?.url && char.referenceImage.url.trim()) {
        // Fallback to original reference photo
        referenceUrl = char.referenceImage.url.startsWith('http')
          ? char.referenceImage.url
          : `${baseUrl}${char.referenceImage.url}`;
        console.log(`[Character] ${char.name}: Using reference photo (no animated preview)`);
      }
      // If neither exists, referenceUrl stays undefined

      return {
        name: char.name,
        referenceImageUrl: referenceUrl || '',
        description: char.description,
      };
    });

    // Build consistent scene settings
    const sceneSettings = buildConsistentSceneSettings(scenes);
    console.log('Scene settings for consistency:', Array.from(sceneSettings.entries()));

    // Generate a story-wide seed for character consistency across all scenes
    // Using a deterministic seed based on character names ensures same characters get similar treatment
    const characterSeedBase = characters.map((c: Character) => c.name).join('').length;
    const storySeed = Math.floor(Math.random() * 1000000) + characterSeedBase * 1000;
    console.log(`🎲 Story seed for consistency: ${storySeed}`);

    // Generate scenes - use staggered parallel for Gemini to avoid rate limits
    // For FLUX, full parallel is fine. For Gemini free tier, we stagger requests.
    const staggerDelayMs = useGemini ? 3000 : 0; // 3 second delay between Gemini requests
    console.log(`🚀 Starting ${useGemini ? 'STAGGERED' : 'PARALLEL'} generation of ${scenes.length} scenes...`);

    const generationPromises = scenes.map(async (scene, index) => {
      // Stagger start times for Gemini to avoid rate limits
      if (staggerDelayMs > 0 && index > 0) {
        await new Promise(resolve => setTimeout(resolve, index * staggerDelayMs));
      }

      try {
        console.log(`Generating image for scene ${scene.sceneNumber}: ${scene.description}`);

        // Extract scene location for consistency
        const sceneLocation = extractSceneLocation(scene.description);
        const locationSetting = sceneLocation ? sceneSettings.get(sceneLocation) : undefined;

        // Filter characters that appear in this scene (or use all if not specified)
        const sceneCharacters = scene.characterNames && scene.characterNames.length > 0
          ? characterPrompts.filter(char => scene.characterNames!.includes(char.name))
          : characterPrompts;

        if (sceneCharacters.length === 0) {
          // If no characters detected, use all available characters
          sceneCharacters.push(...characterPrompts);
        }

        // Generate image using selected provider
        let result;

        if (useGemini) {
          // Use Gemini with actual reference images
          const geminiCharacters: GeminiCharacterInfo[] = sceneCharacters.map(char => ({
            name: char.name,
            referenceImageUrl: char.referenceImageUrl,
            description: char.description,
          }));

          // Choose generation function based on illustration style
          // For coloring book mode: cover (scene 0) uses Pixar style, other scenes use coloring
          const isCoverScene = scene.sceneNumber === 0;
          const effectiveStyle = (selectedIllustrationStyle === 'coloring' && isCoverScene)
            ? 'pixar'  // Cover always colorful even in coloring book mode
            : selectedIllustrationStyle;

          if (effectiveStyle === 'coloring') {
            // Coloring Book - B&W line art for kids to color
            console.log(`[Scene ${scene.sceneNumber}] Using Coloring Book style (B&W line art)`);
            result = await generateImageWithGeminiColoring({
              characters: geminiCharacters,
              sceneDescription: scene.description,
              artStyle: artStyle || "children's coloring book, line art",
              clothingConsistency,
            });
          } else if (effectiveStyle === 'classic') {
            // Classic Storybook - 2D hand-drawn/watercolor style
            result = await generateImageWithGeminiClassic({
              characters: geminiCharacters,
              sceneDescription: scene.description,
              artStyle: artStyle || "children's book illustration, colorful, whimsical",
              clothingConsistency,
            });
          } else {
            // 3D Pixar style (default Gemini behavior)
            if (selectedIllustrationStyle === 'coloring' && isCoverScene) {
              console.log(`[Scene ${scene.sceneNumber}] Cover in coloring mode - using Pixar style for colorful cover`);
            }
            result = await generateImageWithGemini({
              characters: geminiCharacters,
              sceneDescription: scene.description,
              artStyle: artStyle || "children's book illustration, colorful, whimsical",
              clothingConsistency,
            });
          }

          // IMPORTANT: Upload Gemini base64 images to Supabase Storage
          // This converts data:image/... URLs to proper CDN URLs for:
          // 1. Better mobile app compatibility
          // 2. Reduced database storage (no multi-MB base64 strings)
          // 3. Faster page loads with CDN caching
          if (result.imageUrl.startsWith('data:')) {
            try {
              const storageService = new StorageService(supabase);
              // Use requestId as temporary folder path during generation
              // The actual project folder will be created when story is saved
              const uploaded = await storageService.uploadGeneratedImageFromBase64(
                `temp-${requestId}`,
                scene.id,
                result.imageUrl
              );
              console.log(`[Storage] Uploaded Gemini image for scene ${scene.sceneNumber} to: ${uploaded.url}`);
              result.imageUrl = uploaded.url;
            } catch (uploadError) {
              console.warn(`[Storage] Failed to upload Gemini image, keeping base64:`, uploadError);
              // Keep the base64 data URL as fallback if upload fails
            }
          }
        } else {
          // Use FLUX LoRA (text-based prompts only)
          result = await generateImageWithMultipleCharacters({
            characters: sceneCharacters,
            sceneDescription: scene.description,
            artStyle: artStyle || "children's book illustration, colorful, whimsical",
            sceneLocation: locationSetting,
            emphasizeGenericCharacters: true,
            storySeed: storySeed,
          });
        }

        // Create character ratings array for this scene
        const characterRatings: CharacterRating[] = sceneCharacters.map(char => ({
          characterId: characters.find((c: Character) => c.name === char.name)?.id || '',
          characterName: char.name,
        }));

        console.log(`✓ Scene ${scene.sceneNumber} completed in ${result.generationTime}s`);

        return {
          success: true,
          image: {
            id: `img-${scene.id}`,
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            sceneDescription: scene.description,
            imageUrl: result.imageUrl,
            prompt: result.prompt,
            generationTime: result.generationTime,
            status: 'completed' as const,
            characterRatings,
            isCover: scene.sceneNumber === 0,  // NEW: Mark cover image
          }
        };
      } catch (error) {
        console.error(`✗ Scene ${scene.sceneNumber} failed:`, error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Scene ${scene.sceneNumber}: ${errorMessage}`);

        return {
          success: false,
          image: {
            id: `img-${scene.id}`,
            sceneId: scene.id,
            sceneNumber: scene.sceneNumber,
            sceneDescription: scene.description,
            imageUrl: '',
            prompt: scene.description,
            generationTime: 0,
            status: 'failed' as const,
            error: errorMessage,
            isCover: scene.sceneNumber === 0,  // NEW: Mark cover image
          }
        };
      }
    });

    // Wait for all scenes to complete (or fail) - don't let one failure stop others
    const results = await Promise.allSettled(generationPromises);

    // Process results
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        generatedImages.push(result.value.image);
      } else {
        // Promise itself was rejected (shouldn't happen with try/catch above, but just in case)
        console.error(`Scene ${index + 1} promise rejected:`, result.reason);
        errors.push(`Scene ${index + 1}: Promise rejected`);
        generatedImages.push({
          id: `img-${scenes[index].id}`,
          sceneId: scenes[index].id,
          sceneNumber: scenes[index].sceneNumber,
          sceneDescription: scenes[index].description,
          imageUrl: '',
          prompt: scenes[index].description,
          generationTime: 0,
          status: 'failed',
          error: 'Promise rejected',
        });
      }
    });

    console.log(`✅ Parallel generation complete: ${generatedImages.filter(img => img.status === 'completed').length}/${scenes.length} successful`);

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
      limits: rateLimitCheck.limits,
      imageProvider: useGemini ? 'gemini' : 'flux', // Report which provider was used
    });
  } catch (error) {
    console.error('Generate images error:', error);

    // Log error
    const supabase = await createClientFromRequest(request);
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
