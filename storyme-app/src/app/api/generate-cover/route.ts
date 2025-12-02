import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithGemini, generateImageWithGeminiClassic, GeminiCharacterInfo, isGeminiAvailable } from '@/lib/gemini-image-client';
import { Character } from '@/lib/types/story';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, author, age, language = 'en', characters, illustrationStyle, customPrompt } = body;

    // Determine illustration style (default to 'classic' for 2D storybook)
    const selectedStyle = illustrationStyle || 'classic';
    const is3DStyle = selectedStyle === 'pixar';

    // Validate inputs
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    console.log(`📚 Generating cover for: "${title}"`);
    console.log(`Author: ${author || 'Unknown'}`);
    console.log(`Age: ${age || 'N/A'}`);
    console.log(`Language: ${language}`);
    console.log(`Style: ${is3DStyle ? '3D Pixar' : 'Classic Storybook 2D'}`);
    console.log(`Custom Prompt: ${customPrompt ? 'Yes' : 'No (using default)'}`);

    // Build the cover prompt - use custom prompt if provided, otherwise generate default
    // IMPORTANT: Cover must use SAME art style as scene images for consistency
    let coverDescription: string;

    // Extract character names for default scene
    const characterNames = characters?.map((c: Character) => c.name).join(' and ') || 'the main characters';

    // Base scene description for cover (characters in a cover-worthy pose)
    // More specific to generate a good illustration, not just copy reference photos
    const coverSceneBase = `Create an ILLUSTRATED children's book COVER showing ${characterNames} in a magical, eye-catching scene related to "${title}".

The characters should be:
- Smiling and looking happy/excited
- In dynamic, engaging poses (waving, jumping, or adventure-ready)
- Positioned prominently in the center or foreground
- Surrounded by whimsical, colorful background elements that match the story theme

CRITICAL: This must be a 2D ILLUSTRATED drawing in children's book style, NOT a photograph or realistic image. The reference photos are ONLY for understanding the characters' faces - transform them into cute illustrated characters.`;

    // Text handling based on language
    const textInstructions = language === 'en'
      ? `Include ONLY the title "${title}" displayed at the top in clear, stylized letters that match the illustration style. NO subtitles, NO taglines, NO author text, NO publisher text, NO random words.`
      : `ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO CHINESE CHARACTERS anywhere on the image. Leave clear space at top for title overlay.`;

    if (customPrompt && customPrompt.trim()) {
      // User provided custom prompt - still add text instructions
      // Also add reminder to illustrate, not copy photos
      coverDescription = `${customPrompt.trim()}

CRITICAL STYLE REMINDER: Create a 2D ILLUSTRATED children's book image. Reference photos are ONLY for understanding faces - DO NOT reproduce the photos. Transform into cute cartoon-style illustration.

TEXT RULES: ${textInstructions}`;
      console.log('Using custom prompt:', coverDescription);
    } else {
      // Default cover description
      coverDescription = `${coverSceneBase}

${textInstructions}`;
    }

    // Check if Gemini is available
    if (!isGeminiAvailable()) {
      return NextResponse.json(
        { error: 'Gemini API is not configured' },
        { status: 500 }
      );
    }

    // Convert relative URLs to absolute URLs for Gemini
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3002}`;

    // Prepare character info with absolute URLs (if characters provided)
    // Handle both "From Photo" and "From Description" characters
    const geminiCharacters: GeminiCharacterInfo[] = characters && characters.length > 0
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

    console.log(`Generating cover with Gemini (${is3DStyle ? '3D Pixar' : '2D Classic'}), ${geminiCharacters.length} character(s)`);

    // Generate the cover image using the SAME Gemini functions as scene generation
    // This ensures cover style matches scene style exactly
    const result = is3DStyle
      ? await generateImageWithGemini({
          characters: geminiCharacters,
          sceneDescription: coverDescription,
        })
      : await generateImageWithGeminiClassic({
          characters: geminiCharacters,
          sceneDescription: coverDescription,
        });

    console.log(`✅ Cover generated successfully in ${result.generationTime}s`);
    console.log(`AI-generated cover (data URL): ${result.imageUrl.substring(0, 50)}...`);

    // Step 2: Upload the AI-generated cover directly to Supabase storage (no text overlay)
    // Note: Text overlay (author, copyright) will be added by PDF generation if needed
    console.log('☁️ Uploading cover to storage...');
    const supabase = await createClient();

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
