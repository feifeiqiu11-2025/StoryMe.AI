/**
 * API Route: Generate Location Reference Images
 * POST /api/locations/generate-references
 *
 * Given the story-bible locations, generates an establishing-shot reference
 * image for each location that does NOT have a backing character (backed
 * locations reuse that character's image directly — no generation needed).
 *
 * Called by the client in the background after enhance-scenes returns.
 * The client merges returned URLs into storyBible.locations[].reference_image_url,
 * then generate-images uses them as a secondary reference when drawing scenes.
 *
 * Fails gracefully per-location: one Gemini error doesn't block the others.
 * On any failure, the location's temp_id simply won't appear in the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithGemini, isGeminiAvailable } from '@/lib/gemini-image-client';
import { createClientFromRequest } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';

export const maxDuration = 120;

interface LocationInput {
  temp_id: string;
  name: string;
  description: string;
  backing_character_name?: string | null;
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
    const locationsRaw = Array.isArray(body?.locations) ? body.locations : [];
    const locations: LocationInput[] = locationsRaw
      .filter((l: any) => l && typeof l.temp_id === 'string' && typeof l.description === 'string')
      .map((l: any) => ({
        temp_id: String(l.temp_id),
        name: typeof l.name === 'string' ? l.name : '',
        description: String(l.description),
        backing_character_name: l.backing_character_name ?? null,
      }));

    if (locations.length === 0) {
      return NextResponse.json({ locations: {} });
    }

    // Skip locations already backed by a user character — those reuse the character's image.
    const toGenerate = locations.filter(l => !l.backing_character_name);

    const storage = new StorageService(supabase);
    const folder = `location-refs/${user.id}`;

    // Generate references in parallel; each handles its own errors so one bad
    // location doesn't block the others. Locations that fail simply won't appear
    // in the response map — the image-gen fallback is locked-prose consistency.
    const results = await Promise.allSettled(
      toGenerate.map(async loc => {
        const sceneDescription = `Establishing scene, no characters visible, ${loc.description}. Clean, wide view suitable as a reusable background reference across multiple story scenes.`;
        const gen = await generateImageWithGemini({
          characters: [],
          sceneDescription,
          artStyle: "children's book illustration, colorful, whimsical",
          clothingConsistency: 'consistent',
        });

        // If the result is a base64 data URL, upload to Supabase Storage for a CDN-backed URL.
        // If it's already an https URL, pass through.
        let finalUrl = gen.imageUrl;
        if (finalUrl.startsWith('data:')) {
          const uploaded = await storage.uploadGeneratedImageFromBase64(
            folder,
            `loc-${loc.temp_id}`,
            finalUrl
          );
          finalUrl = uploaded.url;
        }
        return { temp_id: loc.temp_id, reference_image_url: finalUrl };
      })
    );

    const locationsMap: Record<string, string> = {};
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value?.reference_image_url) {
        locationsMap[r.value.temp_id] = r.value.reference_image_url;
      } else if (r.status === 'rejected') {
        console.warn(`[generate-references] Location ${toGenerate[idx]?.temp_id} failed:`, r.reason);
      }
    });

    return NextResponse.json({ locations: locationsMap });
  } catch (error) {
    console.error('[generate-references] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
