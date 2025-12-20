/**
 * API Route: Extract PDF Content
 * POST /api/import-pdf/extract
 *
 * Uses Gemini Vision to extract text and images from PDF storybooks.
 * Handles various PDF formats from NotebookLM, Gemini, Canva, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 120; // 2 minute timeout for large PDFs

// Types for extraction
interface ExtractedPage {
  pageNumber: number;
  imageBase64: string;
  captionEnglish: string;
  captionChinese?: string;
  isScenePage: boolean;
  pageType: 'cover' | 'scene' | 'credits' | 'other';
}

interface ExtractionResult {
  title: string;
  totalPages: number;
  pages: ExtractedPage[];
  extractionTime: number;
}

// Gemini extraction prompt - flexible for various PDF formats
// Supports bilingual storybooks (English and Chinese)
const EXTRACTION_PROMPT = `You are analyzing a storybook page image. Extract the story content from this page.

IMPORTANT RULES:
1. Focus ONLY on the main story text that should be narrated/read aloud
2. EXCLUDE any of the following:
   - Educational notes, parent tips, discussion questions
   - "Parent Panel", "Learning Corner", "Did You Know?" sections
   - Author credits, copyright notices, page numbers
   - Any text that is clearly supplementary and not part of the story narrative
3. For COVER pages: Extract the story title (this will be narrated)
4. For CREDITS pages or pages with no story content: mark isScenePage as false

LANGUAGE DETECTION - CRITICAL:
- If text is in ENGLISH, put it in "captionEnglish"
- If text is in CHINESE (including Chinese characters 汉字 or Pinyin with tone marks like māma, bàba), put it in "captionChinese"
- If the page has BOTH English AND Chinese text, extract both separately
- Pinyin (romanized Chinese like "Māma ài nǐ") should go in "captionChinese", NOT "captionEnglish"

Respond in JSON format:
{
  "pageType": "cover" | "scene" | "credits" | "other",
  "isScenePage": boolean (true for cover and scene pages, false for credits/other),
  "title": string (the story title if this is a cover page, otherwise null),
  "captionEnglish": string (English text to be narrated, empty string if no English),
  "captionChinese": string (Chinese text including Pinyin to be narrated, empty string if no Chinese),
  "hasImage": boolean (does this page have a story illustration?)
}

Be concise - extract only the essential story narration text, not descriptions of the image.`;

/**
 * Check if a string contains Chinese characters
 */
function containsChineseCharacters(text: string): boolean {
  // Unicode ranges for Chinese characters:
  // CJK Unified Ideographs: \u4E00-\u9FFF
  // CJK Unified Ideographs Extension A: \u3400-\u4DBF
  // Also check for common Pinyin tone marks
  const chineseCharRegex = /[\u4E00-\u9FFF\u3400-\u4DBF]/;
  const pinyinToneRegex = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i;
  return chineseCharRegex.test(text) || pinyinToneRegex.test(text);
}

/**
 * Extract content from a single PDF page using Gemini Vision
 */
async function extractPageContent(
  genai: GoogleGenAI,
  imageBase64: string,
  pageNumber: number
): Promise<{
  pageType: 'cover' | 'scene' | 'credits' | 'other';
  isScenePage: boolean;
  title: string | null;
  captionEnglish: string;
  captionChinese: string;
}> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              // Client now sends JPEG for smaller payload size
              mimeType: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            text: EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    config: {
      temperature: 0.3, // Lower temperature for more consistent extraction
      maxOutputTokens: 1024,
    },
  });

  const responseText = response.text || '';

  // Parse JSON response
  try {
    // Clean up response - remove markdown code blocks if present
    let cleanedResponse = responseText
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Try to extract JSON if it's embedded in other text
    const jsonMatch = cleanedResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanedResponse = jsonMatch[0];
    }

    const parsed = JSON.parse(cleanedResponse);

    const pageType = parsed.pageType || 'scene';
    let captionEnglish = parsed.captionEnglish || '';
    let captionChinese = parsed.captionChinese || '';

    // Safety check: If Gemini put Chinese in captionEnglish, ALWAYS clear it
    // This prevents Chinese text from being stored in the English field
    // which would cause TTS to use the wrong voice
    if (captionEnglish && containsChineseCharacters(captionEnglish)) {
      // If captionChinese is empty, move the content there
      if (!captionChinese) {
        captionChinese = captionEnglish;
      }
      // Always clear captionEnglish if it contains Chinese
      captionEnglish = '';
    }

    // For cover pages, ensure we have the title as caption (use title if caption is empty)
    if (pageType === 'cover') {
      const title = parsed.title || '';
      if (!captionEnglish && !captionChinese && title) {
        // Detect language of title
        if (containsChineseCharacters(title)) {
          captionChinese = title;
        } else {
          captionEnglish = title;
        }
      } else if (!captionEnglish && !captionChinese) {
        // If no title either, use a default
        captionEnglish = 'Story Cover';
      }
    }

    // Cover and scene pages should be included by default
    const isScenePage = pageType === 'cover' || pageType === 'scene'
      ? (parsed.isScenePage ?? true)
      : false;

    return {
      pageType,
      isScenePage,
      title: parsed.title || null,
      captionEnglish,
      captionChinese,
    };
  } catch (parseError) {
    console.error(`Failed to parse Gemini response for page ${pageNumber}:`, responseText);

    // Try to extract captions from raw text if it looks like JSON
    let fallbackCaption = responseText.substring(0, 500);
    const captionMatch = responseText.match(/"captionEnglish"\s*:\s*"([^"]+)"/);
    if (captionMatch) {
      fallbackCaption = captionMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
    }

    // Check if fallback is actually Chinese
    const isChinese = containsChineseCharacters(fallbackCaption);

    // Fallback - treat as scene with extracted or raw text
    return {
      pageType: 'scene',
      isScenePage: true,
      title: null,
      captionEnglish: isChinese ? '' : fallbackCaption,
      captionChinese: isChinese ? fallbackCaption : '',
    };
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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
    const { pageImages, fileName } = body;

    // Validate inputs
    if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
      return NextResponse.json(
        { error: 'No page images provided' },
        { status: 400 }
      );
    }

    if (pageImages.length > 30) {
      return NextResponse.json(
        { error: 'Maximum 30 pages allowed' },
        { status: 400 }
      );
    }

    console.log(`📄 Extracting ${pageImages.length} pages from PDF: ${fileName}`);

    // Initialize Gemini
    const genai = new GoogleGenAI({
      apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '',
    });

    // Extract content from all pages
    const extractedPages: ExtractedPage[] = [];
    let storyTitle = fileName?.replace(/\.pdf$/i, '') || 'Imported Story';

    for (let i = 0; i < pageImages.length; i++) {
      const pageImage = pageImages[i];
      console.log(`  Processing page ${i + 1}/${pageImages.length}...`);

      try {
        const extracted = await extractPageContent(
          genai,
          pageImage.imageBase64,
          i + 1
        );

        // Use cover page title if found
        if (extracted.pageType === 'cover' && extracted.title) {
          storyTitle = extracted.title;
        }

        extractedPages.push({
          pageNumber: i + 1,
          imageBase64: pageImage.imageBase64,
          captionEnglish: extracted.captionEnglish,
          captionChinese: extracted.captionChinese,
          isScenePage: extracted.isScenePage,
          pageType: extracted.pageType,
        });

      } catch (pageError) {
        console.error(`  Error extracting page ${i + 1}:`, pageError);
        // Add placeholder for failed page
        extractedPages.push({
          pageNumber: i + 1,
          imageBase64: pageImage.imageBase64,
          captionEnglish: '',
          captionChinese: undefined,
          isScenePage: false,
          pageType: 'other',
        });
      }
    }

    const extractionTime = (Date.now() - startTime) / 1000;
    console.log(`✓ Extracted ${extractedPages.length} pages in ${extractionTime.toFixed(1)}s`);

    // Count scene pages
    const sceneCount = extractedPages.filter(p => p.isScenePage).length;
    console.log(`  Found ${sceneCount} scene pages with story content`);

    const result: ExtractionResult = {
      title: storyTitle,
      totalPages: extractedPages.length,
      pages: extractedPages,
      extractionTime,
    };

    return NextResponse.json({
      success: true,
      result,
    });

  } catch (error) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      {
        error: 'Failed to extract PDF content',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
