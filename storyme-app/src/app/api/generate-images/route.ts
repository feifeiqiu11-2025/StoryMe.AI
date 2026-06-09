import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { generateImageWithGemini, generateImageWithGeminiClassic, generateImageWithGeminiColoring, isGeminiAvailable, GeminiCharacterInfo, clearOutfitCache, resolveGeminiImageModel } from '@/lib/gemini-image-client';
import { openaiGenerateScene } from '@/lib/openai-image-client';
import { parseScriptIntoScenes, buildConsistentSceneSettings, extractSceneLocation } from '@/lib/scene-parser';
import { GeneratedImage, Character, CharacterRating, ClothingConsistency, ImageProvider, normalizeImageProvider, isGeminiProvider, isOpenAIProvider, DEFAULT_SCENE_IMAGE_PROVIDER } from '@/lib/types/story';
import { createClientFromRequest } from '@/lib/supabase/server';
import { checkImageGenerationLimit, logApiUsage } from '@/lib/utils/rate-limit';
import { StorageService } from '@/lib/services/storage.service';
import type { StoryBibleResult, BibleLocation, BibleScene } from '@/lib/ai/scene-enhancer';

// Illustration style type
type IllustrationStyle = 'pixar' | 'classic' | 'coloring' | 'ghibli';

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
      coverMetadata,  // NEW: Cover image metadata (title, description, prompt)
      storyBible  // Optional: story-bible payload (pronoun-resolved scenes + locked locations)
    } = body as {
      characters: Character[];
      script: string;
      artStyle?: string;
      imageProvider?: string;
      illustrationStyle?: IllustrationStyle;
      clothingConsistency?: ClothingConsistency;
      coverMetadata?: { title?: string; coverPrompt?: string; description?: string };
      storyBible?: StoryBibleResult | null;
    };

    // Build bible lookups (empty maps when no bible → every lookup returns undefined,
    // so the scene loop falls through to legacy regex-based behavior unchanged).
    const bibleSceneByNumber = new Map<number, BibleScene>();
    const bibleLocationByTempId = new Map<string, BibleLocation>();
    if (storyBible?.scenes) {
      for (const s of storyBible.scenes) {
        if (typeof s.sceneNumber === 'number') bibleSceneByNumber.set(s.sceneNumber, s);
      }
    }
    if (storyBible?.locations) {
      for (const loc of storyBible.locations) {
        if (typeof loc.temp_id === 'string') bibleLocationByTempId.set(loc.temp_id, loc);
      }
    }
    const useStoryBible = bibleSceneByNumber.size > 0;
    if (useStoryBible) {
      console.log(`📖 Story bible active: ${bibleLocationByTempId.size} locations, ${bibleSceneByNumber.size} scenes`);
    }

    // Determine clothing consistency mode (default to 'consistent')
    const clothingConsistency: ClothingConsistency = requestedClothingConsistency || 'consistent';
    console.log(`👔 Clothing consistency mode: ${clothingConsistency}`);

    // Clear outfit cache at the start of a new story generation
    // This ensures outfits don't leak between different story sessions
    clearOutfitCache();

    // Determine illustration style (default to 'classic' for 2D storybook)
    const selectedIllustrationStyle: IllustrationStyle = illustrationStyle || 'classic';
    console.log(`🎨 Illustration style: ${selectedIllustrationStyle}`);

    // Determine which image provider to use.
    // Priority: request param > IMAGE_PROVIDER env var > scene default (gpt-image-2).
    const requestedProviderResolved: ImageProvider = requestedProvider
      ? normalizeImageProvider(requestedProvider)
      : process.env.IMAGE_PROVIDER
        ? normalizeImageProvider(process.env.IMAGE_PROVIDER)
        : DEFAULT_SCENE_IMAGE_PROVIDER;

    // OpenAI gpt-image-2 is now supported for scene generation (open to all users).
    // It only requires an API key; if the key is missing we fall back to Gemini and
    // surface a clear, user-friendly notice instead of silently downgrading.
    let imageProvider: ImageProvider = requestedProviderResolved;
    let providerFallback: string | null = null;
    if (isOpenAIProvider(requestedProviderResolved) && !process.env.OPENAI_API_KEY) {
      const fallbackTarget: ImageProvider = 'gemini-3.1';
      providerFallback = `ChatGPT Image 2.0 isn't available right now. Using Nano Banana 2 for your scenes instead.`;
      console.warn(`[generate-images] ${providerFallback}`);
      imageProvider = fallbackTarget;
    }

    // Validate Gemini is available if requested
    if (isGeminiProvider(imageProvider) && !isGeminiAvailable()) {
      console.warn(`${imageProvider} requested but Gemini not available, falling back to FLUX`);
    }

    const useOpenAI = isOpenAIProvider(imageProvider);
    const useGemini = isGeminiProvider(imageProvider) && isGeminiAvailable();
    const geminiModelId = useGemini ? resolveGeminiImageModel(imageProvider) : undefined;
    console.log(`🎨 Using image provider: ${useOpenAI ? 'OpenAI (gpt-image-2)' : useGemini ? `Gemini (${geminiModelId})` : 'FLUX'}`);


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

      // Filter cover characters to those with a usable reference image. AI-grouped names
      // without references (e.g., "Friends" added by enhancement) end up rendered as
      // invented stand-ins, which is exactly the cover-fidelity bug we want to avoid.
      // For stories where all characters have references, this is a no-op.
      const coverScene = {
        id: 'cover',
        sceneNumber: 0,
        description: coverMetadata.coverPrompt,
        characterNames: characters
          .filter((c: Character) =>
            (c.animatedPreviewUrl && c.animatedPreviewUrl.trim()) ||
            (c.referenceImage?.url && c.referenceImage.url.trim())
          )
          .map((c: Character) => c.name),
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

      // Absolute URLs (http/https) and inline data: URLs are passed through as-is.
      // Anything else is treated as a relative path and prefixed with baseUrl.
      // Without the data: guard a base64 preview becomes "https://prod/data:image/..."
      // which the downstream validator rejects → character has no visual anchor.
      const isAbsolute = (u: string) => u.startsWith('http') || u.startsWith('data:');
      if (char.animatedPreviewUrl && char.animatedPreviewUrl.trim()) {
        // Animated preview exists - use it (best for consistency)
        referenceUrl = isAbsolute(char.animatedPreviewUrl)
          ? char.animatedPreviewUrl
          : `${baseUrl}${char.animatedPreviewUrl}`;
        console.log(`[Character] ${char.name}: Using animated preview for reference`);
      } else if (char.referenceImage?.url && char.referenceImage.url.trim()) {
        // Fallback to original reference photo
        referenceUrl = isAbsolute(char.referenceImage.url)
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

        // Bible lookup for this scene. Cover (scene 0) has no bible entry of its own,
        // so when a bible exists we borrow the primary location (scene 1's location
        // → first-indexed → locations[0]) to anchor the cover to the same place scene 1
        // uses. Prevents cover/scene-1 forest drift.
        const isCoverScene = scene.sceneNumber === 0;
        const bibleScene = bibleSceneByNumber.get(scene.sceneNumber);
        let bibleLocation = bibleScene?.location_temp_id
          ? bibleLocationByTempId.get(bibleScene.location_temp_id) ?? undefined
          : undefined;

        if (isCoverScene && !bibleLocation && useStoryBible && storyBible) {
          const firstSceneLocId = storyBible.scenes?.[0]?.location_temp_id ?? null;
          const primary = (firstSceneLocId ? storyBible.locations.find(l => l.temp_id === firstSceneLocId) : null)
            || storyBible.locations.find(l => l.first_scene_index === 0)
            || storyBible.locations[0]
            || undefined;
          if (primary) bibleLocation = primary;
        }

        // Scene description passed to the image provider. When the bible has a locked
        // location description for this scene, we append it as a "Setting:" block so
        // every scene in this location shares the same visual anchor — this is the
        // Phase 2 prose-based background-consistency fix.
        const sceneDescriptionForPrompt = bibleLocation
          ? `${scene.description}\n\nSetting: ${bibleLocation.description}`
          : scene.description;

        // Legacy location consistency (regex-based) — only used when bible has no location.
        const sceneLocation = bibleLocation ? null : extractSceneLocation(scene.description);
        const locationSetting = sceneLocation ? sceneSettings.get(sceneLocation) : undefined;

        // Build the per-scene character list.
        // Priority: bible's pronoun-resolved names → legacy regex characterNames → all characters.
        // This is the fix for the pronoun bug: "He walks in the forest" no longer produces
        // an empty character list that silently drops the protagonist's reference image.
        let sceneCharacters: CharacterPromptInfo[] = [];
        if (bibleScene?.resolved_character_names?.length) {
          const resolvedSet = new Set(
            bibleScene.resolved_character_names.map(n => n.toLowerCase())
          );
          sceneCharacters = characterPrompts.filter(c => resolvedSet.has(c.name.toLowerCase()));
        } else if (scene.characterNames && scene.characterNames.length > 0) {
          sceneCharacters = characterPrompts.filter(char => scene.characterNames!.includes(char.name));
        }

        if (sceneCharacters.length === 0) {
          // If no characters detected (legacy fallback), use all available characters.
          // Under the bible path we skip this fallback and allow zero characters — pure
          // scenery scenes like "The sun rose over the mountains" should render without
          // forcing the protagonist in.
          if (!bibleScene) {
            sceneCharacters.push(...characterPrompts);
          }
        }

        // If the bible's location is backed by a scene-type character (e.g., "Rainbow House"
        // imported with subject_type='scene'), surface that character's reference image to
        // the provider so the setting looks consistent across scenes. The provider already
        // handles subjectType='scenery' characters by using the description as-is (no clothing
        // logic), so this is a safe append.
        if (bibleLocation?.backing_character_name) {
          const backingName = bibleLocation.backing_character_name.toLowerCase();
          const backingChar = characterPrompts.find(c => c.name.toLowerCase() === backingName);
          if (backingChar && !sceneCharacters.some(c => c.name.toLowerCase() === backingName)) {
            sceneCharacters.push(backingChar);
          }
        } else if (bibleLocation?.reference_image_url) {
          // Phase 3: non-backed location with an auto-generated reference image.
          // Surface it to the provider as a synthetic scenery entry — the reference image
          // becomes another visual anchor for cross-scene background consistency. The
          // Gemini/FLUX clients treat subjectType='scenery' by using the description as-is,
          // so no clothing/animal logic interferes.
          sceneCharacters.push({
            name: bibleLocation.name,
            referenceImageUrl: bibleLocation.reference_image_url,
            description: {
              fullDescription: bibleLocation.description,
              subjectType: 'scenery',
            },
          });
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
              sceneDescription: sceneDescriptionForPrompt,
              artStyle: artStyle || "children's coloring book, line art",
              clothingConsistency,
              modelId: geminiModelId,
            });
          } else if (effectiveStyle === 'classic' || effectiveStyle === 'ghibli') {
            // Classic Storybook (2D) and Ghibli share the same 2D generator;
            // styleVariant swaps only the STYLE line in the prompt.
            console.log(`[Scene ${scene.sceneNumber}] Using ${effectiveStyle === 'ghibli' ? 'Ghibli' : 'Classic 2D'} style`);
            result = await generateImageWithGeminiClassic({
              characters: geminiCharacters,
              sceneDescription: sceneDescriptionForPrompt,
              artStyle: artStyle || "children's book illustration, colorful, whimsical",
              clothingConsistency,
              modelId: geminiModelId,
              styleVariant: effectiveStyle === 'ghibli' ? 'ghibli' : 'classic',
            });
          } else {
            // 3D Pixar style (default Gemini behavior)
            if (selectedIllustrationStyle === 'coloring' && isCoverScene) {
              console.log(`[Scene ${scene.sceneNumber}] Cover in coloring mode - using Pixar style for colorful cover`);
            }
            result = await generateImageWithGemini({
              characters: geminiCharacters,
              sceneDescription: sceneDescriptionForPrompt,
              artStyle: artStyle || "children's book illustration, colorful, whimsical",
              clothingConsistency,
              modelId: geminiModelId,
            });
          }

        } else if (useOpenAI) {
          // OpenAI gpt-image-2 — multi-reference scene generation.
          // Cover (scene 0) stays colorful even in coloring-book mode, matching Gemini.
          const isCoverScene = scene.sceneNumber === 0;
          const effectiveStyle = (selectedIllustrationStyle === 'coloring' && isCoverScene)
            ? 'pixar'
            : selectedIllustrationStyle;
          console.log(`[Scene ${scene.sceneNumber}] Using OpenAI gpt-image-2 (${effectiveStyle})`);
          result = await openaiGenerateScene({
            characters: sceneCharacters.map(char => ({
              name: char.name,
              referenceImageUrl: char.referenceImageUrl,
              descriptionText: char.description?.fullDescription
                || [
                  char.description?.age,
                  char.description?.hairColor && `${char.description.hairColor} hair`,
                  char.description?.clothing && `wearing ${char.description.clothing}`,
                ].filter(Boolean).join(', ')
                || undefined,
            })),
            sceneDescription: sceneDescriptionForPrompt,
            styleVariant: effectiveStyle,
            artStyle,
          });
        } else {
          // Use FLUX LoRA (text-based prompts only)
          result = await generateImageWithMultipleCharacters({
            characters: sceneCharacters,
            sceneDescription: sceneDescriptionForPrompt,
            artStyle: artStyle || "children's book illustration, colorful, whimsical",
            sceneLocation: locationSetting,
            emphasizeGenericCharacters: true,
            storySeed: storySeed,
          });
        }

        // Upload base64 (data:) results to Supabase Storage. Both Gemini and
        // OpenAI return data URLs; converting to CDN URLs gives better mobile
        // compatibility, smaller DB rows, and faster loads. FLUX already returns
        // a hosted URL, so this is skipped for it.
        if (result.imageUrl.startsWith('data:')) {
          const storageService = new StorageService(supabase);
          let uploaded = false;

          // Try upload twice with a short delay between attempts
          for (let attempt = 1; attempt <= 2; attempt++) {
            try {
              const uploadResult = await storageService.uploadGeneratedImageFromBase64(
                `temp-${requestId}`,
                scene.id,
                result.imageUrl
              );
              console.log(`[Storage] Uploaded image for scene ${scene.sceneNumber} (attempt ${attempt}): ${uploadResult.url}`);
              result.imageUrl = uploadResult.url;
              uploaded = true;
              break;
            } catch (uploadError) {
              console.warn(`[Storage] Upload attempt ${attempt}/2 failed for scene ${scene.sceneNumber}:`, uploadError);
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 2000));
              }
            }
          }

          if (!uploaded) {
            console.warn(`[Storage] All upload attempts failed for scene ${scene.sceneNumber}. Base64 will be uploaded client-side before save.`);
            // Keep base64 — the client's uploadPendingBase64Images() will handle it before save
          }
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
      imageProvider: useOpenAI ? 'openai-gpt-image-2' : useGemini ? 'gemini' : 'flux', // Report which provider was used
      providerFallback,  // Non-null only when OpenAI was requested but unavailable (missing key) → Gemini
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
