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
import {
  buildChineseEnhancementPrompt,
  parseChineseEnhancementResponse,
} from '@/lib/ai/scene-enhancer-chinese';
import { getModelForLanguage, logModelUsage } from '@/lib/ai/deepseek-client';
import { StoryTone, ExpansionLevel } from '@/lib/types/story';

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenes,
      readingLevel,
      storyTone,
      characters,
      expansionLevel = 'minimal',
      language = 'en',
      generateChineseTranslation = false  // NEW: For bilingual English stories
    } = body;

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

    console.log(`Enhancing ${scenes.length} scenes with reading level ${readingLevel}, ${storyTone} tone, ${expansionLevel} expansion, language: ${language}`);

    // Build prompt based on language
    const isEnglish = language === 'en';
    const prompt = isEnglish
      ? buildEnhancementPrompt(
          scenes as SceneToEnhance[],
          characters as Character[],
          readingLevel,
          storyTone as StoryTone,
          expansionLevel as ExpansionLevel
        )
      : buildChineseEnhancementPrompt(
          scenes as SceneToEnhance[],
          characters as Character[],
          readingLevel,
          storyTone as StoryTone,
          expansionLevel as ExpansionLevel
        );

    // Get appropriate AI model for language
    const { client, model } = getModelForLanguage(language as 'en' | 'zh');

    console.log(`🤖 Using ${model} for ${language === 'zh' ? 'Chinese' : 'English'} story generation`);

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: language === 'zh'
            ? '你是儿童故事书专家，专门创作引人入胜、适合年龄的中文故事。'
            : 'You are a children\'s storybook expert specializing in creating engaging, age-appropriate stories.'
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

    // Log model usage
    logModelUsage(language as 'en' | 'zh', model, completion.usage);

    // Parse response based on language
    let enhancedScenes: EnhancedSceneResult[];

    try {
      enhancedScenes = language === 'zh'
        ? parseChineseEnhancementResponse(responseText, scenes)
        : parseEnhancementResponse(responseText, scenes);
    } catch (parseError) {
      console.error('Failed to parse AI response, using fallback:', parseError);
      enhancedScenes = createFallbackEnhancement(scenes);
    }

    console.log(`✓ Enhanced ${enhancedScenes.length} scenes successfully`);

    // NEW: If bilingual mode, generate Chinese translations
    if (language === 'en' && generateChineseTranslation) {
      console.log('🌏 Generating Chinese translations for bilingual story...');

      try {
        const { client: zhClient, model: zhModel } = getModelForLanguage('zh');

        // Build simple translation prompt
        const captionsToTranslate = enhancedScenes.map(s => s.caption).join('\n\n');

        const translationPrompt = `Translate the following English children's story captions to Chinese. Keep the same playful, age-appropriate tone. Return ONLY the translations, one per line, in the same order.

English Captions:
${captionsToTranslate}

Chinese Translations:`;

        const translationCompletion = await zhClient.chat.completions.create({
          model: zhModel,
          max_tokens: 2048,
          temperature: 0.5,
          messages: [
            {
              role: 'system',
              content: '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。'
            },
            {
              role: 'user',
              content: translationPrompt
            }
          ]
        });

        const translationsText = translationCompletion.choices[0]?.message?.content || '';
        const translations = translationsText.trim().split('\n').filter(t => t.trim());

        console.log(`✓ Generated ${translations.length} Chinese translations`);

        // Log translation usage
        logModelUsage('zh', zhModel, translationCompletion.usage);

        // Attach translations to enhanced scenes
        enhancedScenes = enhancedScenes.map((scene, index) => ({
          ...scene,
          caption_chinese: translations[index] || scene.caption  // Fallback to English if missing
        }));

      } catch (translationError) {
        console.error('Chinese translation failed, continuing without translations:', translationError);
        // Don't fail the whole request, just skip translations
      }
    }

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
