/**
 * API Route: POST /api/v1/editor/save-as-character
 *
 * Saves an editor-generated image as a character_library row so kids can
 * reuse it in any future book via the same picker the picture-book and
 * chapter-book flows already use.
 *
 * Why subject_type='scene': the schema already has this value (used by
 * the story-bible feature for scenery characters). Saving generated
 * scene images under it means they appear in the picker but are flagged
 * as scenery rather than people — preserving the meaning when the same
 * row gets used as a backing image for picture-book scenes later.
 *
 * Principle 1 (Security): auth gate; user_id forced from the session,
 *   not the request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';

const SaveSchema = z.object({
  imageUrl: z.string().url(),
  name: z.string().min(1).max(80),
  prompt: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = SaveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { imageUrl, name, prompt } = validation.data;

    const { data: row, error: insertError } = await supabase
      .from('character_library')
      .insert({
        user_id: user.id,
        name,
        subject_type: 'scene',
        // Mirror the URL into both reference and animated_preview so the
        // picker, story-bible, and editor all find a thumbnail.
        reference_image_url: imageUrl,
        animated_preview_url: imageUrl,
        // Stash the prompt as the AI description so the picker shows
        // helpful context if we surface it later.
        ai_description: prompt ?? '',
        is_favorite: false,
      })
      .select('id, name, animated_preview_url, reference_image_url')
      .single();

    if (insertError || !row) {
      console.error('save-as-character insert failed:', insertError);
      return NextResponse.json(
        { error: 'Failed to save as character' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      character: {
        id: row.id,
        name: row.name,
        imageUrl: row.animated_preview_url || row.reference_image_url,
      },
    });
  } catch (error) {
    console.error('save-as-character route error:', error);
    return NextResponse.json({ error: 'Failed to save as character' }, { status: 500 });
  }
}
