/**
 * API Route: Translate Captions
 * POST /api/import-pdf/translate
 *
 * Uses DeepSeek to translate English captions to Chinese
 * for bilingual storybook support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deepseek, isDeepSeekConfigured, logModelUsage } from '@/lib/ai/deepseek-client';

export const maxDuration = 60; // 1 minute timeout

interface PageToTranslate {
  pageNumber: number;
  captionEnglish: string;
}

interface TranslatedPage {
  pageNumber: number;
  captionChinese: string;
}

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
    const { pages } = body as { pages: PageToTranslate[] };

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

    console.log(`🌐 Translating ${pages.length} captions to Chinese...`);

    // Build translation prompt
    const captionsText = pages
      .map((p, i) => `[Page ${p.pageNumber}]\n${p.captionEnglish}`)
      .join('\n\n');

    const translationPrompt = `Translate the following English children's story captions to Chinese.

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

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 4096,
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content: '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。保持故事的趣味性和可读性。'
        },
        {
          role: 'user',
          content: translationPrompt
        }
      ]
    });

    const responseText = completion.choices[0]?.message?.content || '';

    // Log usage
    logModelUsage('zh', 'deepseek-chat', completion.usage);

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
          captionChinese: translation,
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
            captionChinese: lines[index].trim(),
          });
        }
      });
    }

    console.log(`✓ Translated ${translations.length} captions`);

    // Fill in any missing translations with fallback
    const translationMap = new Map(translations.map(t => [t.pageNumber, t]));
    const allTranslations = pages.map(page => {
      const existing = translationMap.get(page.pageNumber);
      if (existing) {
        return existing;
      }
      // Fallback: try individual translation
      return {
        pageNumber: page.pageNumber,
        captionChinese: page.captionEnglish, // Keep English as fallback
      };
    });

    return NextResponse.json({
      success: true,
      translations: allTranslations,
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
