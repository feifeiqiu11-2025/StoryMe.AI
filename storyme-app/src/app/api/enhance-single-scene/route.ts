/**
 * Enhance Single Scene API
 *
 * Enhances a single scene description into age-appropriate caption and detailed image prompt.
 * Used when user adds a new scene manually.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getModelForLanguage, logModelUsage } from '@/lib/ai/deepseek-client';

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sceneDescription,
      characterNames = [],
      readingLevel = 5,
      storyTone = 'playful',
      expansionLevel = 'as_written',
      language = 'en'
    } = body;

    // Validate inputs
    if (!sceneDescription || typeof sceneDescription !== 'string') {
      return NextResponse.json(
        { error: 'Scene description is required' },
        { status: 400 }
      );
    }

    if (sceneDescription.trim().length < 10) {
      return NextResponse.json(
        { error: 'Scene description must be at least 10 characters' },
        { status: 400 }
      );
    }

    console.log(`[Enhance Single Scene] Processing scene for age ${readingLevel}, ${storyTone} tone, ${language} language`);

    // Get appropriate AI model for language
    const { client, model } = getModelForLanguage(language as 'en' | 'zh');
    logModelUsage(language as 'en' | 'zh', model);

    // Build the prompt based on expansion level
    let expansionGuidance = '';
    if (expansionLevel === 'light') {
      expansionGuidance = 'Enhance with sensory details, emotional context, and age-appropriate language.';
    } else if (expansionLevel === 'rich') {
      expansionGuidance = 'Add rich sensory details, emotional depth, and scene-setting descriptions.';
    } else {
      // as_written: keep it close to the original
      expansionGuidance = 'Keep the caption close to the original description. Focus on generating a good image prompt.';
    }

    const systemPrompt = `You are a children's book author creating age-appropriate content for ${readingLevel}-year-olds with a ${storyTone} tone.

Your task: Transform a simple scene description into TWO outputs:
1. **caption**: Age-appropriate text for ${readingLevel}-year-olds (for the storybook page)
2. **enhanced_prompt**: Detailed visual description for AI image generation

READING LEVEL GUIDELINES:
- Age 1-2: Single words or short phrases (e.g., "Dog!" or "Mommy. Ball.")
- Age 3-4: Very short sentences (e.g., "Emma plays. She is happy!")
- Age 5: Short simple sentences (e.g., "Emma went to the park.")
- Age 6: Building vocabulary with compound words (8-12 words/sentence)
- Age 7-8: Richer vocabulary, descriptive words (10-15 words/sentence)
- Age 9-10: Complex narratives with character thoughts (12-20 words/sentence)
- Age 11-12: Advanced narratives with literary techniques (15-25 words/sentence)

TONE GUIDELINES (${storyTone}):
- playful: Fun, giggly, lighthearted, humorous, whimsical
- educational: Learning-focused, informative, curious
- adventure: Exciting, brave, exploratory, courageous, confident
- friendly: Social, kind, warm, cooperative, caring

EXPANSION LEVEL: ${expansionGuidance}

${characterNames.length > 0 ? `Characters in this scene: ${characterNames.join(', ')}` : ''}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "caption": "age-appropriate text",
  "enhanced_prompt": "detailed visual description for image generation"
}`;

    const userPrompt = `Scene description: ${sceneDescription.trim()}

Generate the caption and enhanced_prompt.`;

    // Call AI
    const completion = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from AI');
    }

    const result = JSON.parse(content);

    console.log(`[Enhance Single Scene] ✓ Enhanced successfully`);

    return NextResponse.json({
      enhanced_prompt: result.enhanced_prompt || sceneDescription,
      caption: result.caption || sceneDescription,
    });

  } catch (error) {
    console.error('[Enhance Single Scene] Error:', error);

    // Return fallback response instead of error
    return NextResponse.json({
      enhanced_prompt: 'A scene from a children\'s story',
      caption: 'A scene from a children\'s story',
      warning: 'AI enhancement unavailable, using original description'
    });
  }
}
