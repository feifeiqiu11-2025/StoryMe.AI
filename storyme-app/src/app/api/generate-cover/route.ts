import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithGemini, generateImageWithGeminiClassic, GeminiCharacterInfo, isGeminiAvailable } from '@/lib/gemini-image-client';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { Character } from '@/lib/types/story';
import { createClientFromRequest } from '@/lib/supabase/server';

// Image provider type
type ImageProvider = 'flux' | 'gemini';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, author, age, language = 'en', characters, illustrationStyle, customPrompt, imageProvider: requestedProvider } = body;

    // Determine illustration style (default to 'classic' for 2D storybook)
    // For coloring book mode, cover should always be colorful (use pixar style)
    const requestedStyle = illustrationStyle || 'classic';
    const selectedStyle = requestedStyle === 'coloring' ? 'pixar' : requestedStyle;
    const is3DStyle = selectedStyle === 'pixar';

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
    const defaultProvider: ImageProvider = (process.env.IMAGE_PROVIDER as ImageProvider) || 'gemini';
    const imageProvider: ImageProvider = requestedProvider || defaultProvider;
    const useGemini = imageProvider === 'gemini' && isGeminiAvailable();

    console.log(`📚 Generating cover for: "${title}"`);
    console.log(`Author: ${author || 'Unknown'}`);
    console.log(`Age: ${age || 'N/A'}`);
    console.log(`Language: ${language}`);
    console.log(`Style: ${is3DStyle ? '3D Pixar' : 'Classic Storybook 2D'}`);
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

    if (customPrompt && customPrompt.trim()) {
      // User provided custom prompt - keep it simple
      coverDescription = `Book cover scene: ${customPrompt.trim()}. ${textInstructions}`;
      console.log('Using custom prompt:', coverDescription);
    } else {
      // Default cover description - concise, let style come from Gemini functions
      const storyContext = description ? `Story theme: ${description}. ` : '';
      coverDescription = `Book COVER for "${title}". ${storyContext}Show ${characterNames} in an exciting moment, dynamic poses, colorful background. ${textInstructions}`;
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
    // Handle both "From Photo" and "From Description" characters
    const preparedCharacters = characters && characters.length > 0
      ? characters.map((char: Character) => {
          // Handle reference image URL - may be empty for "From Description" characters
          let referenceImageUrl = '';
          if (char.referenceImage?.url) {
            referenceImageUrl = char.referenceImage.url.startsWith('http')
              ? char.referenceImage.url
              : `${baseUrl}${char.referenceImage.url}`;
          }

          return {
            name: char.name,
            referenceImageUrl,
            description: char.description, // Includes fullDescription for proper character context
          };
        })
      : [];

    console.log(`Generating cover with ${useGemini ? 'Gemini' : 'Fal.ai'} (${is3DStyle ? '3D Pixar' : '2D Classic'}), ${preparedCharacters.length} character(s)`);

    // Generate the cover image using selected provider
    let result;

    if (useGemini) {
      // Use Gemini with reference photos
      const geminiCharacters: GeminiCharacterInfo[] = preparedCharacters;
      result = is3DStyle
        ? await generateImageWithGemini({
            characters: geminiCharacters,
            sceneDescription: coverDescription,
          })
        : await generateImageWithGeminiClassic({
            characters: geminiCharacters,
            sceneDescription: coverDescription,
          });
    } else {
      // Use Fal.ai FLUX (text-based prompts)
      const falCharacters: CharacterPromptInfo[] = preparedCharacters;
      result = await generateImageWithMultipleCharacters({
        characters: falCharacters,
        sceneDescription: coverDescription,
        artStyle: is3DStyle
          ? "3D animated Pixar/Disney style, soft rounded features, vibrant colors"
          : "2D hand-drawn storybook illustration, soft watercolor, warm pastel colors",
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
