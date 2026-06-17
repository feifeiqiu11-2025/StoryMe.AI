import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithGemini, generateImageWithGeminiClassic, GeminiCharacterInfo, isGeminiAvailable, resolveGeminiImageModel } from '@/lib/gemini-image-client';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { Character, ImageProvider, normalizeImageProvider, isGeminiProvider } from '@/lib/types/story';
import { createClientFromRequest } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, author, age, language = 'en', characters, illustrationStyle, customPrompt, imageProvider: requestedProvider } = body;

    // Determine illustration style (default to 'classic' for 2D storybook)
    // For coloring book mode, cover should always be colorful (use pixar style)
    const requestedStyle = illustrationStyle || 'classic';
    const selectedStyle = requestedStyle === 'coloring' ? 'pixar' : requestedStyle;

    if (requestedStyle === 'coloring') {
      console.log(`🖍️ Coloring book mode - cover will use 3D Pixar style (colorful)`);
    }

    // Validate inputs
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Determine which image provider to use
    const defaultProvider = normalizeImageProvider(process.env.IMAGE_PROVIDER);
    const imageProvider: ImageProvider = normalizeImageProvider(requestedProvider) || defaultProvider;
    const useGemini = isGeminiProvider(imageProvider) && isGeminiAvailable();
    const geminiModelId = useGemini ? resolveGeminiImageModel(imageProvider) : undefined;

    console.log(`📚 Generating cover for: "${title}"`);
    console.log(`Author: ${author || 'Unknown'}`);
    console.log(`Age: ${age || 'N/A'}`);
    console.log(`Language: ${language}`);
    console.log(`Style: ${selectedStyle}`);
    console.log(`Image Provider: ${useGemini ? 'Gemini' : 'Fal.ai FLUX'}`);
    console.log(`Custom Prompt: ${customPrompt ? 'Yes' : 'No (using default)'}`);

    // Build the cover prompt - use custom prompt if provided, otherwise generate default
    // IMPORTANT: Cover must use SAME art style as scene images for consistency
    let coverDescription: string;

    // Extract character names for default scene
    const characterNames = characters?.map((c: Character) => c.name).join(' and ') || 'the main characters';

    // Text handling based on language - simplified
    const textInstructions = language === 'en'
      ? `Add title "${title}" at top in stylized letters. No other text.`
      : `NO TEXT on image. Leave space at top for title.`;

    // Realistic covers must avoid the whimsical/cartoon framing below (which pushes
    // anthropomorphic creatures with cartoon eyes) and depict everything true-to-life.
    const isRealistic = selectedStyle === 'realistic';
    const realismClause = isRealistic
      ? ' Depict every creature and person realistically and true-to-life — accurate anatomy and natural proportions, NO cartoon faces or eyes, NO anthropomorphism.'
      : '';

    if (customPrompt && customPrompt.trim()) {
      // User provided custom prompt - keep it simple
      coverDescription = `Book cover scene: ${customPrompt.trim()}.${realismClause} ${textInstructions}`;
      console.log('Using custom prompt:', coverDescription);
    } else {
      // Default cover description - concise, let style come from Gemini functions
      const storyContext = description ? `Story theme: ${description}. ` : '';
      const composition = isRealistic
        ? `Show ${characterNames} naturally in a real-world scene from the book.`
        : `Show ${characterNames} in an exciting moment, dynamic poses, colorful background.`;
      coverDescription = `Book COVER for "${title}". ${storyContext}${composition}${realismClause} ${textInstructions}`;
    }

    // Check if selected provider is available
    if (useGemini && !isGeminiAvailable()) {
      console.warn('Gemini requested but not available, falling back to Fal.ai');
    }

    // Convert relative URLs to absolute URLs
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3002}`;

    // Prepare character info with absolute URLs (if characters provided)
    // Handle both "From Photo" and "From Description" characters.
    // Priority: animated preview (already in illustration style) > reference photo > none.
    // This mirrors scene generation so the cover renders characters with the SAME
    // visual anchor as the interior pages — critical for "From Description" characters,
    // whose only visual identity lives in animatedPreviewUrl (referenceImage.url is empty).
    //
    // Absolute URLs (http/https) and inline data: URLs are passed through as-is.
    // Anything else is treated as a relative path and prefixed with baseUrl.
    // Without the data: guard a base64 preview becomes "https://prod/data:image/..."
    // which the downstream validator rejects → character has no visual anchor.
    const isAbsolute = (u: string) => u.startsWith('http') || u.startsWith('data:');
    const preparedCharacters = characters && characters.length > 0
      ? characters.map((char: Character) => {
          let referenceImageUrl = '';
          if (char.animatedPreviewUrl && char.animatedPreviewUrl.trim()) {
            // Animated preview exists - use it (best for consistency)
            referenceImageUrl = isAbsolute(char.animatedPreviewUrl)
              ? char.animatedPreviewUrl
              : `${baseUrl}${char.animatedPreviewUrl}`;
          } else if (char.referenceImage?.url && char.referenceImage.url.trim()) {
            // Fallback to original reference photo
            referenceImageUrl = isAbsolute(char.referenceImage.url)
              ? char.referenceImage.url
              : `${baseUrl}${char.referenceImage.url}`;
          }
          // If neither exists, referenceImageUrl stays '' (text-only generation)

          return {
            name: char.name,
            referenceImageUrl,
            description: char.description, // Includes fullDescription for proper character context
          };
        })
      : [];

    console.log(`Generating cover with ${useGemini ? 'Gemini' : 'Fal.ai'} (${selectedStyle}), ${preparedCharacters.length} character(s)`);
    preparedCharacters.forEach((c: { name: string; referenceImageUrl: string }) => {
      const anchor = c.referenceImageUrl
        ? (c.referenceImageUrl.startsWith('data:') ? 'data: preview' : c.referenceImageUrl.slice(0, 60))
        : 'NONE (text-only)';
      console.log(`[Cover] ${c.name}: reference = ${anchor}`);
    });

    // Generate the cover image using selected provider
    let result;

    if (useGemini) {
      // Use Gemini with reference photos.
      // Pixar uses the 3D generator; classic, ghibli and realistic share the 2D
      // generator (styleVariant swaps the STYLE line — and, for realistic, the
      // photographic look). Coloring was already remapped to pixar above so the
      // cover stays colorful.
      const geminiCharacters: GeminiCharacterInfo[] = preparedCharacters;
      if (selectedStyle === 'pixar') {
        result = await generateImageWithGemini({
          characters: geminiCharacters,
          sceneDescription: coverDescription,
          modelId: geminiModelId,
        });
      } else {
        result = await generateImageWithGeminiClassic({
          characters: geminiCharacters,
          sceneDescription: coverDescription,
          modelId: geminiModelId,
          styleVariant: selectedStyle === 'ghibli' ? 'ghibli' : selectedStyle === 'realistic' ? 'realistic' : 'classic',
        });
      }
    } else {
      // Use Fal.ai FLUX (text-based prompts). Keep "warm rich colors" rather than
      // "soft watercolor/pastel" so the printed cover holds contrast.
      const falCharacters: CharacterPromptInfo[] = preparedCharacters;
      const falArtStyle =
        selectedStyle === 'pixar'
          ? "3D animated Pixar/Disney style, soft rounded features, vibrant colors"
          : selectedStyle === 'ghibli'
          ? "Studio Ghibli-inspired illustration, warm rich colors"
          : selectedStyle === 'realistic'
          ? "photorealistic, lifelike image, naturalistic detail, realistic lighting, true-to-life colors"
          : "2D hand-drawn storybook illustration, warm rich colors";
      result = await generateImageWithMultipleCharacters({
        characters: falCharacters,
        sceneDescription: coverDescription,
        artStyle: falArtStyle,
        emphasizeGenericCharacters: false,
      });
    }

    console.log(`✅ Cover generated successfully in ${result.generationTime}s`);
    console.log(`AI-generated cover (data URL): ${result.imageUrl.substring(0, 50)}...`);

    // Step 2: Upload the AI-generated cover directly to Supabase storage (no text overlay)
    // Note: Text overlay (author, copyright) will be added by PDF generation if needed
    console.log('☁️ Uploading cover to storage...');
    // Supports both cookie-based and Bearer token auth
    const supabase = await createClientFromRequest(request);

    // Get user (authenticated or guest)
    const { data: { user } } = await supabase.auth.getUser();

    // Use user ID if authenticated, otherwise use 'guest' folder
    const userId = user?.id || 'guest';

    // Convert data URL to buffer (Gemini returns base64 data URL)
    let imageBuffer: Buffer;
    if (result.imageUrl.startsWith('data:')) {
      // Extract base64 data from data URL
      const base64Data = result.imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Fallback: fetch from URL if it's a regular URL
      const imageResponse = await fetch(result.imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch AI-generated image: ${imageResponse.statusText}`);
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    }

    const fileName = `${userId}/covers/${Date.now()}.png`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(`Failed to upload final cover: ${uploadError.message}`);
    }

    // Get public URL of the uploaded cover
    const { data: urlData } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    const finalCoverUrl = urlData.publicUrl;
    console.log(`✅ Cover uploaded successfully: ${finalCoverUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl: finalCoverUrl,
      prompt: result.prompt,
      generationTime: result.generationTime,
    });
  } catch (error) {
    console.error('❌ Generate cover error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate cover image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
