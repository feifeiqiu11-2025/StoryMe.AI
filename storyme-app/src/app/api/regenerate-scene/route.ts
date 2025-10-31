/**
 * Regenerate Scene Image API
 *
 * Regenerates a single scene image based on user feedback.
 * Uses AI to refine the prompt based on common issues like:
 * - Extra/unwanted characters or objects
 * - Wrong anatomy (3 legs, 2 heads, etc.)
 * - Missing objects
 * - Wrong expressions or poses
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithMultipleCharacters, CharacterPromptInfo } from '@/lib/fal-client';
import { extractSceneLocation } from '@/lib/scene-parser';
import { Character } from '@/lib/types/story';
import OpenAI from 'openai';

export const maxDuration = 300; // 5 minutes timeout

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Refine prompt based on user feedback using AI
 */
async function refinePromptWithFeedback(
  originalPrompt: string,
  userFeedback: string,
  sceneDescription: string,
  characterNames: string[]
): Promise<string> {
  const systemPrompt = `You are an expert at refining image generation prompts based on user feedback about issues in generated images.

COMMON ISSUES AND HOW TO FIX THEM:

1. EXTRA/UNKNOWN CHARACTERS OR OBJECTS:
   - Feedback: "There's an extra person in the background"
   - Fix: Add "ONLY [exact count] [characters]", "no other people", "isolated scene"
   - Example: "ONLY ONE boy and ONLY ONE dog, no other people or animals"

2. WRONG ANATOMY (extra limbs, wrong body parts):
   - Feedback: "The character has three legs" or "Two heads"
   - Fix: Add "anatomically correct", "realistic human proportions", specify exact count
   - Example: "girl with TWO arms and TWO legs (anatomically correct), realistic proportions"

3. MISSING OBJECTS:
   - Feedback: "The mat is missing" or "No trees in background"
   - Fix: Emphasize the missing object, use "MUST SHOW", make it specific
   - Example: "cat sitting ON TOP OF a clearly visible red mat (mat MUST be visible)"

4. WRONG EXPRESSIONS/POSES:
   - Feedback: "Character should be smiling" or "Wrong pose"
   - Fix: Add specific emotion/action descriptors
   - Example: "girl with a big HAPPY SMILE, joyful expression, cheerful"

5. BACKGROUND/SETTING ISSUES:
   - Feedback: "Background is too dark" or "Wrong location"
   - Fix: Be very specific about background, lighting, colors
   - Example: "bright sunny park, vibrant green grass, blue sky, well-lit scene"

INSTRUCTIONS:
- Keep the refined prompt under 500 characters
- Maintain the original art style and core scene
- Use UPPERCASE for emphasis on critical fixes
- Be very specific about counts (ONLY ONE, TWO legs, etc.)
- Always include character names if provided

Original prompt: ${originalPrompt}
Scene description: ${sceneDescription}
Characters: ${characterNames.join(', ')}
User feedback: ${userFeedback}

Generate a refined prompt that fixes the issues mentioned in the user feedback while maintaining the original scene's intent.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Refine this prompt based on the feedback: "${userFeedback}"` }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const refinedPrompt = completion.choices[0]?.message?.content?.trim();

    if (!refinedPrompt) {
      console.warn('[Regenerate] AI returned empty prompt, using fallback');
      return buildFallbackRefinedPrompt(originalPrompt, userFeedback);
    }

    console.log('[Regenerate] AI refined prompt:', refinedPrompt);
    return refinedPrompt;

  } catch (error) {
    console.error('[Regenerate] AI refinement failed:', error);
    return buildFallbackRefinedPrompt(originalPrompt, userFeedback);
  }
}

/**
 * Fallback prompt refinement without AI
 */
function buildFallbackRefinedPrompt(originalPrompt: string, userFeedback: string): string {
  // Simple rule-based refinement
  const feedback = userFeedback.toLowerCase();
  let refinedPrompt = originalPrompt;

  // Handle extra characters/objects
  if (feedback.includes('extra') || feedback.includes('unwanted') || feedback.includes('too many')) {
    refinedPrompt = `ONLY the main characters, ${refinedPrompt}, no extra people or objects in background`;
  }

  // Handle anatomy issues
  if (feedback.includes('leg') || feedback.includes('arm') || feedback.includes('hand') || feedback.includes('head')) {
    refinedPrompt = `${refinedPrompt}, anatomically correct, realistic human proportions`;
  }

  // Handle missing objects
  if (feedback.includes('missing') || feedback.includes('add ')) {
    refinedPrompt = `${refinedPrompt}, clearly showing all mentioned objects`;
  }

  return refinedPrompt.substring(0, 500);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sceneId,
      sceneNumber,
      userFeedback,
      originalPrompt,
      originalSceneDescription,
      characters,
      artStyle,
      sceneLocation,
    } = body;

    // Validate inputs
    if (!sceneId || !sceneNumber) {
      return NextResponse.json(
        { error: 'Scene ID and number are required' },
        { status: 400 }
      );
    }

    if (!userFeedback) {
      return NextResponse.json(
        { error: 'User feedback is required' },
        { status: 400 }
      );
    }

    if (!originalPrompt) {
      return NextResponse.json(
        { error: 'Original prompt is required' },
        { status: 400 }
      );
    }

    if (!characters || characters.length === 0) {
      return NextResponse.json(
        { error: 'At least one character is required' },
        { status: 400 }
      );
    }

    console.log(`[Regenerate] Scene ${sceneNumber} with user feedback`);
    console.log(`[Regenerate] User feedback: ${userFeedback}`);
    console.log(`[Regenerate] Original prompt: ${originalPrompt.substring(0, 100)}...`);

    // Refine the prompt based on user feedback
    const characterNames = characters.map((c: Character) => c.name);
    const refinedPrompt = await refinePromptWithFeedback(
      originalPrompt,
      userFeedback,
      originalSceneDescription,
      characterNames
    );

    console.log(`[Regenerate] Refined prompt: ${refinedPrompt.substring(0, 100)}...`);

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

    // Extract location if not provided
    const location = sceneLocation || extractSceneLocation(refinedPrompt);

    console.log(`[Regenerate] Scene location: ${location}`);
    console.log(`[Regenerate] Characters: ${characterPrompts.map(c => c.name).join(', ')}`);

    // Generate the image with refined prompt
    const startTime = Date.now();
    const result = await generateImageWithMultipleCharacters({
      characters: characterPrompts,
      sceneDescription: refinedPrompt, // Use the AI-refined prompt
      artStyle: artStyle || "children's book illustration, colorful, whimsical",
      sceneLocation: location,
      emphasizeGenericCharacters: true,
    });
    const generationTime = (Date.now() - startTime) / 1000;

    console.log(`[Regenerate] ✓ Scene ${sceneNumber} completed in ${generationTime}s`);

    // Return the new image data
    return NextResponse.json({
      success: true,
      generatedImage: {
        id: sceneId, // Keep the same ID to replace existing
        sceneId: sceneId, // Add sceneId field
        sceneNumber,
        sceneDescription: originalSceneDescription, // Keep original description
        imageUrl: result.imageUrl,
        prompt: refinedPrompt, // Store the refined prompt that was used
        userFeedback: userFeedback, // Store the user feedback for reference
        generationTime,
        status: 'completed',
        characterRatings: characters.map((char: Character) => ({
          characterId: char.id,
          characterName: char.name,
        })),
      },
    });

  } catch (error) {
    console.error('[Regenerate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to regenerate image',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
