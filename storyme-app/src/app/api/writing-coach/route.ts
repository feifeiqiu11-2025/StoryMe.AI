/**
 * API Route: Writing Coach
 * POST /api/writing-coach
 *
 * Provides two layers of writing coaching for story scripts:
 * 1. Polish: grammar, conciseness, clarity corrections
 * 2. Strengthen: template-aware guiding questions (9 tips, paginated client-side)
 *
 * Uses Gemini 2.5 Flash for fast, high-quality coaching.
 * Single AI call returns both sections in structured JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { buildCoachPrompt, type WritingCoachResult } from '@/lib/ai/writing-coach';
import { StoryTemplateId } from '@/lib/types/story';
import { STORY_TEMPLATES } from '@/lib/ai/story-templates';

export const maxDuration = 30; // 30 second timeout

const GEMINI_MODEL = 'gemini-2.5-flash';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      templateId,
      characters = [],
      readingLevel = 7,
    } = body;

    // Validate inputs
    if (!script || typeof script !== 'string' || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script is required' },
        { status: 400 }
      );
    }

    if (script.trim().length < 10) {
      return NextResponse.json(
        { error: 'Script must be at least 10 characters' },
        { status: 400 }
      );
    }

    // Validate templateId if provided
    if (templateId && !STORY_TEMPLATES[templateId as StoryTemplateId]) {
      return NextResponse.json(
        { error: `Invalid template ID: ${templateId}` },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    console.log(`[Writing Coach] Processing script (${script.length} chars), template: ${templateId || 'none'}, readingLevel: ${readingLevel}`);

    // Build the coaching prompt
    const { systemPrompt, userPrompt } = buildCoachPrompt({
      script: script.trim(),
      templateId: templateId || null,
      characters,
      readingLevel,
    });

    console.log(`[Writing Coach] Using ${GEMINI_MODEL}`);

    const genAI = new GoogleGenAI({ apiKey });

    const result = await genAI.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
        },
      ],
      config: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    // Extract text from response
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new Error('No content in Gemini response');
    }

    const textPart = parts.find((p: { text?: string }) => p.text);
    if (!textPart?.text) {
      throw new Error('No text in Gemini response');
    }

    // Clean markdown code blocks if present
    let content = textPart.text.trim();
    content = content.replace(/^```json\s*/i, '');
    content = content.replace(/^```\s*/i, '');
    content = content.replace(/\s*```$/i, '');
    content = content.trim();

    // Try to extract JSON object if embedded in other text
    if (!content.startsWith('{')) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
    }

    // Parse the response
    let coachResult: WritingCoachResult;
    try {
      coachResult = JSON.parse(content);
    } catch (parseError) {
      console.error('[Writing Coach] Failed to parse JSON response:', content.substring(0, 500));
      throw new Error('Failed to parse coaching response');
    }

    // Validate response structure
    if (!coachResult.polish || !coachResult.strengthen) {
      throw new Error('Invalid coaching response structure');
    }

    // Ensure arrays exist
    if (!Array.isArray(coachResult.polish.changes)) {
      coachResult.polish.changes = [];
    }
    if (!Array.isArray(coachResult.strengthen.tips)) {
      coachResult.strengthen.tips = [];
    }

    console.log(`[Writing Coach] Generated ${coachResult.polish.changes.length} polish changes and ${coachResult.strengthen.tips.length} strengthen tips`);

    return NextResponse.json({
      success: true,
      ...coachResult,
    });

  } catch (error) {
    console.error('[Writing Coach] Error:', error);

    return NextResponse.json(
      {
        error: 'Writing coach unavailable. Please try again.',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
