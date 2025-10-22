import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { Character } from '@/lib/types/story';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, author, characters } = body;

    // Validate inputs
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    console.log(`📚 Generating cover for: "${title}"`);
    console.log(`Author: ${author || 'Unknown'}`);

    // Build the cover prompt - include title in AI image, author will be overlaid
    const coverDescription = `Children's storybook cover illustration with the title "${title}" displayed prominently in large, clear, readable text at the top. ${description ? description + '. ' : ''}Professional children's book cover design, colorful, whimsical, magical, appealing to 5-6 year olds, award-winning illustration style. Include small text "KindleWood Studio" in bottom corner as copyright. Leave the bottom 15% with less busy details for author credit placement. Book cover composition with clear title text`;

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
    console.log(`Cover URL: ${result.imageUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl: result.imageUrl,
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
