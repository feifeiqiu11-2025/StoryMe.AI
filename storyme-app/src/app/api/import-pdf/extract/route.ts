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
const EXTRACTION_PROMPT = `You are analyzing a storybook page image. Extract the story content from this page.

IMPORTANT RULES:
1. Focus ONLY on the main story text that should be narrated/read aloud
2. EXCLUDE any of the following:
   - Educational notes, parent tips, discussion questions
   - "Parent Panel", "Learning Corner", "Did You Know?" sections
   - Author credits, copyright notices, page numbers
   - Any text that is clearly supplementary and not part of the story narrative
3. For COVER pages: Extract the story title as captionEnglish (this will be narrated)
4. For CREDITS pages or pages with no story content: mark isScenePage as false

Respond in JSON format:
{
  "pageType": "cover" | "scene" | "credits" | "other",
  "isScenePage": boolean (true for cover and scene pages, false for credits/other),
  "title": string (the story title if this is a cover page, otherwise null),
  "captionEnglish": string (the text to be narrated - for cover pages use the title, for scenes use the story text),
  "hasImage": boolean (does this page have a story illustration?)
}

Be concise - extract only the essential story narration text, not descriptions of the image.`;

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
}> {
  const model = genai.models.generateContent;

  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
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

    // For cover pages, ensure we have the title as caption (use title if caption is empty)
    if (pageType === 'cover') {
      if (!captionEnglish && parsed.title) {
        captionEnglish = parsed.title;
      } else if (!captionEnglish) {
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
    };
  } catch (parseError) {
    console.error(`Failed to parse Gemini response for page ${pageNumber}:`, responseText);

    // Try to extract captionEnglish from raw text if it looks like JSON
    let fallbackCaption = responseText.substring(0, 500);
    const captionMatch = responseText.match(/"captionEnglish"\s*:\s*"([^"]+)"/);
    if (captionMatch) {
      fallbackCaption = captionMatch[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"');
    }

    // Fallback - treat as scene with extracted or raw text
    return {
      pageType: 'scene',
      isScenePage: true,
      title: null,
      captionEnglish: fallbackCaption,
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
