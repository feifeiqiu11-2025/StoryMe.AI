/**
 * API Route: Generate New-Character Reference Images
 * POST /api/characters/generate-references
 *
 * Sibling to /api/locations/generate-references. Given recurring NEW characters
 * surfaced by the Story Bible (not in the user's library), generates a clean
 * character reference image for each, in the SELECTED art style, so the on-demand
 * preview on the review page matches the book and the batch can reuse it.
 *
 * Fails gracefully per-character: one Gemini error doesn't block the others.
 * On any failure, the character's temp_id simply won't appear in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithGemini, generateImageWithGeminiClassic, generateImageWithGeminiColoring, isGeminiAvailable } from '@/lib/gemini-image-client';
import { createClientFromRequest } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';

export const maxDuration = 120;

interface CharInput {
  temp_id: string;
  name: string;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!isGeminiAvailable()) {
      return NextResponse.json(
        { error: 'Gemini image model is not configured on the server' },
        { status: 503 }
      );
    }

    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Render in the selected art style so the preview matches the book's look.
    const illustrationStyle: string = typeof body?.illustrationStyle === 'string' ? body.illustrationStyle : 'classic';
    const charsRaw = Array.isArray(body?.characters) ? body.characters : [];
    const characters: CharInput[] = charsRaw
      .filter((c: any) => c && typeof c.temp_id === 'string' && typeof c.description === 'string')
      .map((c: any) => ({
        temp_id: String(c.temp_id),
        name: typeof c.name === 'string' ? c.name : '',
        description: String(c.description),
      }));

    if (characters.length === 0) {
      return NextResponse.json({ characters: {} });
    }

    const storage = new StorageService(supabase);
    const folder = `character-refs/${user.id}`;

    const results = await Promise.allSettled(
      characters.map(async c => {
        const sceneDescription = `Character reference, full body, neutral pose, plain simple background. ${c.description}. Suitable as a reusable character reference across multiple story scenes.`;
        // Same style dispatch as the batch scene generator so previews match the book.
        const gen = illustrationStyle === 'coloring'
          ? await generateImageWithGeminiColoring({
              characters: [],
              sceneDescription,
              artStyle: "children's coloring book, line art",
              clothingConsistency: 'consistent',
            })
          : (illustrationStyle === 'classic' || illustrationStyle === 'ghibli' || illustrationStyle === 'realistic')
          ? await generateImageWithGeminiClassic({
              characters: [],
              sceneDescription,
              artStyle: "children's book illustration",
              clothingConsistency: 'consistent',
              styleVariant: illustrationStyle === 'ghibli' ? 'ghibli' : illustrationStyle === 'realistic' ? 'realistic' : 'classic',
            })
          : await generateImageWithGemini({
              characters: [],
              sceneDescription,
              artStyle: "children's book illustration",
              clothingConsistency: 'consistent',
            });

        let finalUrl = gen.imageUrl;
        if (finalUrl.startsWith('data:')) {
          const uploaded = await storage.uploadGeneratedImageFromBase64(
            folder,
            `char-${c.temp_id}`,
            finalUrl
          );
          finalUrl = uploaded.url;
        }
        return { temp_id: c.temp_id, reference_image_url: finalUrl };
      })
    );

    const charactersMap: Record<string, string> = {};
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value?.reference_image_url) {
        charactersMap[r.value.temp_id] = r.value.reference_image_url;
      } else if (r.status === 'rejected') {
        console.warn(`[character-references] Character ${characters[idx]?.temp_id} failed:`, r.reason);
      }
    });

    return NextResponse.json({ characters: charactersMap });
  } catch (error) {
    console.error('[character-references] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
