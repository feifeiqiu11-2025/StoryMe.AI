/**
 * API Route: Character Breakdown — Finalize Phase
 * POST /api/characters/[id]/breakdown/finalize
 *
 * Takes the user-approved list of items from the plan phase (possibly with
 * renamed/role-adjusted entries) and inserts one character_library row per
 * item, linked back to the source via derived_from_id. Source character is
 * left untouched.
 *
 * Validates each previewUrl points at our own character-images bucket + the
 * expected breakdown-* path prefix — prevents clients from pointing new rows
 * at arbitrary URLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getCharacterById, createCharacter } from '@/lib/db/characters';
import { logApiUsage } from '@/lib/utils/rate-limit';
import type { CharacterLibrary } from '@/lib/types/database';
import { z } from 'zod';

export const maxDuration = 30;

const MAX_ITEMS = 8;

const itemSchema = z.object({
  name: z.string().min(1).max(255),
  role: z.enum(['character', 'scene_element']),
  previewUrl: z.string().url(),
});

const finalizeSchema = z.object({
  items: z.array(itemSchema).min(1).max(MAX_ITEMS),
});

/**
 * Validate previewUrl is one of our own breakdown crops in the right bucket
 * under the caller's own user folder. Prevents a client from pointing a new
 * character row at an arbitrary URL.
 */
function isOwnBreakdownUrl(previewUrl: string, userId: string, sourceCharacterId: string): boolean {
  try {
    const url = new URL(previewUrl);
    // Expected path shape:
    //   /storage/v1/object/public/character-images/{userId}/breakdown-{sourceCharId}-...
    const expectedPrefix = `/storage/v1/object/public/character-images/${userId}/breakdown-${sourceCharacterId}-`;
    return url.pathname.startsWith(expectedPrefix);
  } catch {
    return false;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: characterId } = await params;

  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: sourceCharacter, error: loadErr } = await getCharacterById(supabase, characterId);
    if (loadErr || !sourceCharacter) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    if (sourceCharacter.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = finalizeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { items } = parsed.data;

    // URL tampering guard: all previewUrls must point at this user's breakdown crops.
    for (const item of items) {
      if (!isOwnBreakdownUrl(item.previewUrl, user.id, characterId)) {
        return NextResponse.json(
          { error: `previewUrl rejected for "${item.name}" — must be a breakdown crop from this character.` },
          { status: 400 }
        );
      }
    }

    const created: CharacterLibrary[] = [];
    const failed: Array<{ name: string; error: string }> = [];

    for (const item of items) {
      try {
        const { data, error } = await createCharacter(supabase, user.id, {
          name: item.name,
          is_favorite: false,
          role: item.role,
          derived_from_id: sourceCharacter.id,
          animated_preview_url: item.previewUrl,
          // Reference image = the source character's animated preview (the uncropped multi-element)
          reference_image_url: sourceCharacter.animated_preview_url,
          // Inherit subject_type from source; scene_element role overrides to 'scenery'
          subject_type: item.role === 'scene_element' ? 'scenery' : sourceCharacter.subject_type,
          // Inherit designer info so the breakdown children stay grouped under the same kid
          designer_name: sourceCharacter.designer_name ?? null,
          designer_age: sourceCharacter.designer_age ?? null,
        });

        if (error || !data) {
          failed.push({ name: item.name, error: error?.message ?? 'Insert returned no data' });
          continue;
        }
        created.push(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failed.push({ name: item.name, error: msg });
      }
    }

    await logApiUsage({
      userId: user.id,
      endpoint: `/api/characters/${characterId}/breakdown/finalize?created=${created.length}&failed=${failed.length}`,
      method: 'POST',
      statusCode: created.length > 0 ? 200 : 500,
      responseTimeMs: Date.now() - startTime,
      charactersCreated: created.length,
    });

    return NextResponse.json({
      created,
      failed: failed.length > 0 ? failed : undefined,
    }, { status: created.length > 0 ? 200 : 500 });
  } catch (error) {
    console.error('[Breakdown Finalize] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to finalize breakdown', details: errorMessage },
      { status: 500 }
    );
  }
}
