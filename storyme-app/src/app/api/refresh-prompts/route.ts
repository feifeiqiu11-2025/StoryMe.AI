/**
 * API Route: Refresh Stale Scene Prompts
 * POST /api/refresh-prompts
 *
 * Called by the client on "Approve & Generate" when the user has edited
 * characters or location on one or more scenes via the review-UI chips.
 * Re-runs the LLM for just those scenes to produce fresh enhanced_prompt +
 * caption that reflect the edits, while staying coherent with unchanged scenes.
 *
 * English-only for now; matches enableStoryBible gating.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  buildRefreshPromptsPrompt,
  parseRefreshPromptsResponse,
  type SceneForRefresh,
  type Character,
  type BibleLocation,
} from '@/lib/ai/scene-enhancer';
import { getModelForLanguage, logModelUsage } from '@/lib/ai/deepseek-client';
import { StoryTone } from '@/lib/types/story';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      scenesToRefresh,       // SceneForRefresh[]
      allScenesForContext,   // [{ sceneNumber, caption }, ...] — full list of enhanced scenes for coherence context
      locations,             // BibleLocation[] — from storyBible.locations
      characters,            // Character[] — { name, description, ... }
      readingLevel,
      storyTone,
      language = 'en',
    } = body as {
      scenesToRefresh: SceneForRefresh[];
      allScenesForContext: Array<{ sceneNumber: number; caption: string }>;
      locations: BibleLocation[];
      characters: Character[];
      readingLevel: number;
      storyTone: StoryTone;
      language?: string;
    };

    if (!Array.isArray(scenesToRefresh) || scenesToRefresh.length === 0) {
      return NextResponse.json({ error: 'scenesToRefresh required' }, { status: 400 });
    }
    if (!readingLevel || readingLevel < 1 || readingLevel > 12) {
      return NextResponse.json({ error: 'readingLevel required (1..12)' }, { status: 400 });
    }
    if (!storyTone) {
      return NextResponse.json({ error: 'storyTone required' }, { status: 400 });
    }
    if (!Array.isArray(characters) || characters.length === 0) {
      return NextResponse.json({ error: 'characters required' }, { status: 400 });
    }
    if (language !== 'en') {
      // Phase 4 only targets English stories (matches enableStoryBible gating).
      return NextResponse.json({ error: 'refresh-prompts is English-only in this phase' }, { status: 400 });
    }

    const prompt = buildRefreshPromptsPrompt(
      scenesToRefresh,
      Array.isArray(allScenesForContext) ? allScenesForContext : [],
      Array.isArray(locations) ? locations : [],
      characters,
      readingLevel,
      storyTone
    );

    const { client, model } = getModelForLanguage('en');

    const completion = await client.chat.completions.create({
      model,
      max_tokens: 2048,
      temperature: 0.5,
      messages: [
        { role: 'system', content: 'You are a children\'s storybook editor updating scenes after the user edited characters or locations.' },
        { role: 'user', content: prompt },
      ],
    });

    logModelUsage('en', model, completion.usage);
    const responseText = completion.choices[0]?.message?.content || '';

    let refreshed: ReturnType<typeof parseRefreshPromptsResponse>;
    try {
      refreshed = parseRefreshPromptsResponse(responseText);
    } catch (parseError) {
      console.error('[refresh-prompts] Failed to parse LLM output:', parseError);
      console.error('[refresh-prompts] Raw response was:', responseText);
      return NextResponse.json({ error: 'Failed to parse refresh response' }, { status: 502 });
    }

    if (refreshed.length === 0) {
      return NextResponse.json({ error: 'No scenes refreshed — LLM returned empty list' }, { status: 502 });
    }

    return NextResponse.json({ success: true, scenes: refreshed });
  } catch (error) {
    console.error('[refresh-prompts] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
