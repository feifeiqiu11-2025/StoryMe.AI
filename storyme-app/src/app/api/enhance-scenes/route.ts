/**
 * API Route: Enhance Scene Descriptions
 * POST /api/enhance-scenes
 *
 * Uses Claude/OpenAI to enhance raw scene descriptions into:
 * 1. Enhanced prompts for image generation (detailed, visual)
 * 2. Age-appropriate captions for PDF storybook
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  buildEnhancementPrompt,
  parseEnhancementResponse,
  createFallbackEnhancement,
  type SceneToEnhance,
  type Character,
  type EnhancedSceneResult
} from '@/lib/ai/scene-enhancer';
import { StoryTone, ExpansionLevel } from '@/lib/types/story';

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { scenes, readingLevel, storyTone, characters, expansionLevel = 'minimal' } = body;

    // Validate inputs
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scene is required' },
        { status: 400 }
      );
    }

    if (!readingLevel || readingLevel < 3 || readingLevel > 8) {
      return NextResponse.json(
        { error: 'Reading level must be between 3 and 8' },
        { status: 400 }
      );
    }

    if (!storyTone) {
      return NextResponse.json(
        { error: 'Story tone is required' },
        { status: 400 }
      );
    }

    if (!characters || !Array.isArray(characters) || characters.length === 0) {
      return NextResponse.json(
        { error: 'At least one character is required' },
        { status: 400 }
      );
    }

    const validTones: StoryTone[] = [
      'playful', 'educational', 'adventure', 'gentle',
      'silly', 'mystery', 'friendly', 'brave'
    ];

    if (!validTones.includes(storyTone)) {
      return NextResponse.json(
        { error: `Invalid story tone. Must be one of: ${validTones.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`Enhancing ${scenes.length} scenes with reading level ${readingLevel}, ${storyTone} tone, and ${expansionLevel} expansion`);

    // Build prompt for AI
    const prompt = buildEnhancementPrompt(
      scenes as SceneToEnhance[],
      characters as Character[],
      readingLevel,
      storyTone as StoryTone,
      expansionLevel as ExpansionLevel
    );

    // Call OpenAI API
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You are a children\'s storybook expert specializing in creating engaging, age-appropriate stories.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    // Extract text response
    const responseText = completion.choices[0]?.message?.content || '';

    console.log('AI Response:', responseText.substring(0, 200) + '...');

    // Parse response
    let enhancedScenes: EnhancedSceneResult[];

    try {
      enhancedScenes = parseEnhancementResponse(responseText, scenes);
    } catch (parseError) {
      console.error('Failed to parse AI response, using fallback:', parseError);
      enhancedScenes = createFallbackEnhancement(scenes);
    }

    console.log(`✓ Enhanced ${enhancedScenes.length} scenes successfully`);

    return NextResponse.json({
      success: true,
      enhancedScenes,
      readingLevel,
      storyTone,
    });

  } catch (error) {
    console.error('Scene enhancement error:', error);

    // Return fallback on error
    const { scenes } = await request.json();

    if (scenes && Array.isArray(scenes)) {
      console.warn('Returning fallback enhancement due to error');
      return NextResponse.json({
        success: false,
        enhancedScenes: createFallbackEnhancement(scenes),
        error: 'AI enhancement failed, using original descriptions',
        warning: true
      });
    }

    return NextResponse.json(
      {
        error: 'Failed to enhance scenes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
