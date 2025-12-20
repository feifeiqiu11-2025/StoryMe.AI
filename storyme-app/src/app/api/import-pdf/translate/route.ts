/**
 * API Route: Translate Captions
 * POST /api/import-pdf/translate
 *
 * Uses DeepSeek to translate captions between English and Chinese
 * for bilingual storybook support.
 *
 * Supports both directions:
 * - direction: 'en-to-zh' (default) - English to Chinese
 * - direction: 'zh-to-en' - Chinese to English
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deepseek, isDeepSeekConfigured, logModelUsage } from '@/lib/ai/deepseek-client';

export const maxDuration = 60; // 1 minute timeout

interface PageToTranslate {
  pageNumber: number;
  captionEnglish?: string;
  captionChinese?: string;
}

interface TranslatedPage {
  pageNumber: number;
  captionEnglish?: string;
  captionChinese?: string;
}

type TranslationDirection = 'en-to-zh' | 'zh-to-en';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { pages, direction = 'en-to-zh' } = body as {
      pages: PageToTranslate[];
      direction?: TranslationDirection;
    };

    // Validate inputs
    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No pages to translate' },
        { status: 400 }
      );
    }

    // Check if DeepSeek is configured
    if (!isDeepSeekConfigured()) {
      return NextResponse.json(
        { error: 'Translation service not configured' },
        { status: 500 }
      );
    }

    const isChineseToEnglish = direction === 'zh-to-en';
    const sourceField = isChineseToEnglish ? 'captionChinese' : 'captionEnglish';
    const targetField = isChineseToEnglish ? 'captionEnglish' : 'captionChinese';
    const sourceLang = isChineseToEnglish ? 'Chinese' : 'English';
    const targetLang = isChineseToEnglish ? 'English' : 'Chinese';

    console.log(`🌐 Translating ${pages.length} captions from ${sourceLang} to ${targetLang}...`);

    // Build translation prompt
    const captionsText = pages
      .map((p) => `[Page ${p.pageNumber}]\n${isChineseToEnglish ? p.captionChinese : p.captionEnglish}`)
      .join('\n\n');

    const translationPrompt = isChineseToEnglish
      ? `Translate the following Chinese children's story captions to English.

TRANSLATION GUIDELINES:
1. Keep the same playful, age-appropriate tone suitable for children
2. Maintain the narrative flow and emotional tone
3. Use simple, clear English suitable for young readers
4. Preserve any character names (keep Chinese names or transliterate if appropriate)
5. Keep the translations natural and engaging for kids

Return ONLY the translations in the EXACT same format, with [Page X] markers.

Chinese Captions:
${captionsText}

English Translations:`
      : `Translate the following English children's story captions to Chinese.

TRANSLATION GUIDELINES:
1. Keep the same playful, age-appropriate tone suitable for children
2. Maintain the narrative flow and emotional tone
3. Use simple, clear Chinese suitable for young readers
4. Preserve any character names (transliterate if appropriate)
5. Keep the translations natural and engaging for kids

Return ONLY the translations in the EXACT same format, with [Page X] markers.

English Captions:
${captionsText}

Chinese Translations:`;

    const systemPrompt = isChineseToEnglish
      ? 'You are a professional children\'s story translator, skilled at translating Chinese stories into lively, child-friendly English. Maintain the fun and readability of the story.'
      : '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。保持故事的趣味性和可读性。';

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: translationPrompt
        }
      ]
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Log usage
    logModelUsage(isChineseToEnglish ? 'en' : 'zh', 'deepseek-chat', completion.usage);

    // Parse translations
    const translations: TranslatedPage[] = [];

    // Extract translations by page number markers
    const pagePattern = /\[Page (\d+)\]\s*\n?([\s\S]*?)(?=\[Page \d+\]|$)/g;
    let match;

    while ((match = pagePattern.exec(responseText)) !== null) {
      const pageNumber = parseInt(match[1], 10);
      const translation = match[2].trim();

      if (translation) {
        translations.push({
          pageNumber,
          [targetField]: translation,
        });
      }
    }

    // If parsing failed, try line-by-line matching
    if (translations.length === 0) {
      const lines = responseText.split('\n').filter(line => line.trim());
      pages.forEach((page, index) => {
        if (lines[index]) {
          translations.push({
            pageNumber: page.pageNumber,
            [targetField]: lines[index].trim(),
          });
        }
      });
    }

    console.log(`✓ Translated ${translations.length} captions from ${sourceLang} to ${targetLang}`);

    // Fill in any missing translations with fallback
    const translationMap = new Map(translations.map(t => [t.pageNumber, t]));
    const allTranslations = pages.map(page => {
      const existing = translationMap.get(page.pageNumber);
      if (existing) {
        return existing;
      }
      // Fallback: keep source as target
      const sourceCaption = isChineseToEnglish ? page.captionChinese : page.captionEnglish;
      return {
        pageNumber: page.pageNumber,
        [targetField]: sourceCaption,
      };
    });

    return NextResponse.json({
      success: true,
      translations: allTranslations,
      direction,
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to translate captions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
