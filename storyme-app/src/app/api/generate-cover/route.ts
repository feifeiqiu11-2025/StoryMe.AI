import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { Character } from '@/lib/types/story';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, author, age, language = 'en', characters } = body;

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

    // Build the cover prompt based on language
    let coverDescription: string;

    if (language === 'en') {
      // English: Include ONLY the title text in AI prompt
      // IMPORTANT: AI often generates gibberish text - be very explicit about what NOT to include
      coverDescription = `Children's storybook cover illustration with ONLY the title "${title}" displayed at the top in clear English letters. ${description ? description + '. ' : ''}Professional children's book cover design, colorful, whimsical, magical, appealing to 5-6 year olds, award-winning illustration style. Clean composition focusing on the illustration and title. NO subtitles, NO taglines, NO author text, NO publisher text, NO random words or letters anywhere on the cover - ONLY the title "${title}" and the illustration. Book cover style with minimal text`;
    } else {
      // Chinese: NO TEXT AT ALL (prevents random Chinese characters, we'll overlay programmatically)
      coverDescription = `Children's storybook cover illustration WITHOUT ANY TEXT WHATSOEVER. ${description ? description + '. ' : ''}Professional children's book cover design, colorful, whimsical, magical, appealing to 5-6 year olds, award-winning illustration style. Clean composition with clear space at top for title and bottom for credits. Book cover style illustration. ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO CHINESE CHARACTERS, NO NUMBERS, NO SYMBOLS on the image - ONLY pure visual illustration with NO text elements at all`;
    }

    // Convert relative URLs to absolute URLs for Fal.ai
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3002}`;

    // Prepare character prompt info with absolute URLs (if characters provided)
    const characterPrompts: CharacterPromptInfo[] = characters && characters.length > 0
      ? characters.map((char: Character) => ({
          name: char.name,
          referenceImageUrl: char.referenceImage.url.startsWith('http')
            ? char.referenceImage.url
            : `${baseUrl}${char.referenceImage.url}`,
          description: char.description,
        }))
      : [];

    console.log(`Generating cover with ${characterPrompts.length} character(s)`);

    // Generate the cover image
    const result = await generateImageWithMultipleCharacters({
      characters: characterPrompts,
      sceneDescription: coverDescription,
      artStyle: "children's book cover, professional, whimsical, colorful, magical",
      emphasizeGenericCharacters: true,
    });

    console.log(`✅ Cover generated successfully in ${result.generationTime}s`);
    console.log(`AI-generated cover URL: ${result.imageUrl}`);

    // Step 2: Upload the AI-generated cover directly to Supabase storage (no text overlay)
    // Note: Text overlay (author, copyright) will be added by PDF generation if needed
    console.log('☁️ Uploading cover to storage...');
    const supabase = await createClient();

    // Get user (authenticated or guest)
    const { data: { user } } = await supabase.auth.getUser();

    // Use user ID if authenticated, otherwise use 'guest' folder
    const userId = user?.id || 'guest';

    // Fetch the AI-generated image as a buffer
    const imageResponse = await fetch(result.imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch AI-generated image: ${imageResponse.statusText}`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

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
