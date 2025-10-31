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
      expansionLevel = 'minimal',
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
    logModelUsage(model, language as 'en' | 'zh', 'enhance-single-scene');

    // Build the prompt based on expansion level
    let expansionGuidance = '';
    if (expansionLevel === 'moderate') {
      expansionGuidance = 'Add sensory details and emotional context.';
    } else if (expansionLevel === 'rich') {
      expansionGuidance = 'Add rich sensory details, emotional depth, and scene-setting descriptions.';
    } else {
      expansionGuidance = 'Keep it concise and focused on the main action.';
    }

    const systemPrompt = `You are a children's book author creating age-appropriate content for ${readingLevel}-year-olds with a ${storyTone} tone.

Your task: Transform a simple scene description into TWO outputs:
1. **caption**: Age-appropriate text for ${readingLevel}-year-olds (for the storybook page)
2. **enhanced_prompt**: Detailed visual description for AI image generation

READING LEVEL GUIDELINES:
- Age 1: Single words only (e.g., "Dog!" or "Ball!")
- Age 2: 2-3 simple words (e.g., "Mommy. Ball." or "Dog runs!")
- Age 3: Very short sentences (e.g., "Emma plays. She is happy!")
- Age 4-5: Short simple sentences (e.g., "Emma went to the park.")
- Age 6-8: More complex sentences with descriptive words

TONE GUIDELINES (${storyTone}):
- playful: Fun, giggly, lighthearted
- educational: Learning-focused, informative
- adventure: Exciting, brave, exploratory
- gentle: Calm, soothing, peaceful
- silly: Wacky, absurd, funny
- mystery: Curious, wondering, discovering
- friendly: Social, kind, warm
- brave: Courageous, strong, determined

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
      enhanced_prompt: body.sceneDescription || 'A scene from a children\'s story',
      caption: body.sceneDescription || 'A scene from a children\'s story',
      warning: 'AI enhancement unavailable, using original description'
    });
  }
}
