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
import { StoryTone, ExpansionLevel, StoryTemplateId } from '@/lib/types/story';
import { generateStoryMetadata } from '@/lib/ai/metadata-generator';
import { buildCoverPrompt } from '@/lib/ai/cover-prompt-builder';
import { getStoryArchitecture } from '@/lib/ai/story-templates';
import { translateCaptions } from '@/lib/ai/caption-translator';
import { isSupportedSecondaryLanguage, type SecondaryLanguage } from '@/lib/config/languages';

export const maxDuration = 60; // 1 minute timeout

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenes,
      readingLevel,
      storyTone,
      characters,
      expansionLevel = 'as_written',
      language = 'en',
      generateChineseTranslation = false,  // Legacy param — backward compat alias for secondaryLanguage='zh'
      secondaryLanguage: rawSecondaryLanguage,  // Generic: 'zh', 'ko', etc.
      script,  // Raw script text for title/description generation
      templateBasePrompt,  // Optional: story category guidance from selected template
      templateId  // Optional: template ID for story architecture
    } = body;

    // Validate inputs
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: 'At least one scene is required' },
        { status: 400 }
      );
    }

    if (!readingLevel || readingLevel < 1 || readingLevel > 12) {
      return NextResponse.json(
        { error: 'Reading level must be between 1 and 12' },
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
      'playful', 'educational', 'adventure', 'friendly'
    ];

    if (!validTones.includes(storyTone)) {
      return NextResponse.json(
        { error: `Invalid story tone. Must be one of: ${validTones.join(', ')}` },
        { status: 400 }
      );
    }

    // Resolve secondary language: new param takes precedence, old boolean is backward compat alias
    const secondaryLanguage: SecondaryLanguage | null =
      (rawSecondaryLanguage && isSupportedSecondaryLanguage(rawSecondaryLanguage))
        ? rawSecondaryLanguage
        : (generateChineseTranslation ? 'zh' : null);

    console.log(`Enhancing ${scenes.length} scenes with reading level ${readingLevel}, ${storyTone} tone, ${expansionLevel} expansion, language: ${language}${secondaryLanguage ? `, secondary: ${secondaryLanguage}` : ''}`);

    // Get story architecture if template is selected
    const storyArchitecture = templateId
      ? getStoryArchitecture(templateId as StoryTemplateId)
      : undefined;

    if (storyArchitecture) {
      console.log(`📐 Using story architecture for template: ${templateId}`);
    }

    // Build prompt based on language
    const isEnglish = language === 'en';
    const prompt = isEnglish
      ? buildEnhancementPrompt(
          scenes as SceneToEnhance[],
          characters as Character[],
          readingLevel,
          storyTone as StoryTone,
          expansionLevel as ExpansionLevel,
          templateBasePrompt,
          storyArchitecture,
          script
        )
      : buildChineseEnhancementPrompt(
          scenes as SceneToEnhance[],
          characters as Character[],
          readingLevel,
          storyTone as StoryTone,
          expansionLevel as ExpansionLevel,
          templateBasePrompt,
          storyArchitecture,
          script
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

    // For "as_written" mode: override AI captions with user's exact original text.
    // The AI may still subtly change wording despite instructions — this guarantees
    // the child's original script is preserved verbatim. Image prompts remain AI-generated.
    if (expansionLevel === 'as_written') {
      enhancedScenes = enhancedScenes.map((scene, index) => {
        const originalScene = (scenes as SceneToEnhance[])[index];
        if (originalScene) {
          return {
            ...scene,
            caption: originalScene.rawDescription,
          };
        }
        return scene;
      });
    }

    console.log(`✓ Enhanced ${enhancedScenes.length} scenes successfully`);

    // NEW: Generate title and description for the story
    let metadata = {
      title: '',
      description: '',
      coverPrompt: ''
    };

    if (script && script.trim()) {
      try {
        console.log('🎨 Generating story title and description...');
        const storyMetadata = await generateStoryMetadata({
          script,
          readingLevel,
          storyTone,
          characterNames: characters.map((c: Character) => c.name),
          language: language as 'en' | 'zh'
        });

        // Build cover prompt using the generated title
        const coverPrompt = buildCoverPrompt({
          title: storyMetadata.title,
          description: storyMetadata.description,
          characterNames: characters.map((c: Character) => c.name),
          language: language as 'en' | 'zh'
        });

        metadata = {
          title: storyMetadata.title,
          description: storyMetadata.description,
          coverPrompt
        };

        console.log(`✓ Generated title: "${metadata.title}"`);
        console.log(`✓ Generated description: "${metadata.description}"`);
      } catch (metadataError) {
        console.error('Metadata generation failed, using fallback:', metadataError);
        // Use fallback values
        const firstWords = script.trim().split(' ').slice(0, 5).join(' ');
        metadata = {
          title: firstWords || 'My Amazing Story',
          description: 'A wonderful adventure awaits!',
          coverPrompt: buildCoverPrompt({
            title: firstWords || 'My Amazing Story',
            description: 'A wonderful adventure awaits!',
            characterNames: characters.map((c: Character) => c.name),
            language: language as 'en' | 'zh'
          })
        };
      }
    } else {
      console.warn('No script provided, skipping metadata generation');
    }

    // Generate secondary language translations if requested
    if (language === 'en' && secondaryLanguage) {
      try {
        const translations = await translateCaptions(
          enhancedScenes.map(s => s.caption),
          secondaryLanguage,
          { readingLevel, storyTone }
        );

        enhancedScenes = enhancedScenes.map((scene, index) => ({
          ...scene,
          caption_secondary: translations[index],
          // Backward compat: also set caption_chinese when secondary is Chinese
          ...(secondaryLanguage === 'zh' ? { caption_chinese: translations[index] } : {}),
        }));
      } catch (translationError) {
        console.error(`${secondaryLanguage} translation failed, continuing without translations:`, translationError);
      }
    }

    return NextResponse.json({
      success: true,
      metadata,  // NEW: Include title, description, coverPrompt
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
