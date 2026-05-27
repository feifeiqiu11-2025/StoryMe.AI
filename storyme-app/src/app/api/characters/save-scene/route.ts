/**
 * API Route: /api/characters/save-scene
 * POST — Save an auto-detected story-bible location as a reusable "scene" character
 *        in the user's library. Dedupes by (user_id, name, subject_type='scene');
 *        returns the existing row if one matches rather than inserting a duplicate.
 *
 * Request body:
 *   {
 *     name: string,
 *     description: string,
 *     referenceImageUrl?: string | null,   // copied from a backing character when present
 *     sourceStoryLocationId?: string | null // FK back to story_locations once persisted
 *   }
 *
 * Response:
 *   { character: CharacterLibrary, created: boolean }
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const referenceImageUrl: string | null =
      typeof body?.referenceImageUrl === 'string' && body.referenceImageUrl.trim().length > 0
        ? body.referenceImageUrl
        : null;
    const sourceStoryLocationId: string | null =
      typeof body?.sourceStoryLocationId === 'string' && body.sourceStoryLocationId.length > 0
        ? body.sourceStoryLocationId
        : null;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: 'description is required' }, { status: 400 });
    }

    // Dedupe: case-insensitive name match on the user's existing scene-type characters
    const { data: existingRows, error: lookupError } = await supabase
      .from('character_library')
      .select('*')
      .eq('user_id', user.id)
      .eq('subject_type', 'scene')
      .ilike('name', name)
      .limit(1);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existingRows && existingRows.length > 0) {
      return NextResponse.json({ character: existingRows[0], created: false });
    }

    // Insert a fresh character_library row. subject_type='scene' marks it as a
    // location-capable character; future enhance calls will detect it as a location backer.
    const insertPayload: Record<string, unknown> = {
      user_id: user.id,
      name,
      ai_description: description,
      subject_type: 'scene',
      // Keep role in sync with subject_type — this row IS a location backer,
      // so it must be a scene_element. Without this, sceneTypeCharacters in
      // scene-enhancer would skip it once that filter starts trusting `role`.
      role: 'scene_element',
      reference_image_url: referenceImageUrl,
      is_favorite: false,
      usage_count: 0,
    };
    if (sourceStoryLocationId) {
      insertPayload.source_story_location_id = sourceStoryLocationId;
    }

    const { data: inserted, error: insertError } = await supabase
      .from('character_library')
      .insert(insertPayload)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ character: inserted, created: true });
  } catch (error) {
    console.error('[save-scene] Unexpected error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
