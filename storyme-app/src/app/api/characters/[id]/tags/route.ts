/**
 * API Route: /api/characters/[id]/tags
 * PUT - Set tags for a character (replaces all tags)
 *
 * Auth required.
 * - Regular users can only tag their own characters (RLS enforced).
 * - Admin users can tag any character (uses service role client).
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'admin@kindlewoodstudio.ai',
];

const UpdateTagsSchema = z.object({
  tags: z
    .array(z.string().min(1).max(50))
    .max(10, 'Maximum 10 tags per character'),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = UpdateTagsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Trim and deduplicate tags
    const tags = [...new Set(validation.data.tags.map((t) => t.trim()))].filter(
      Boolean
    );

    const isAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase());

    if (isAdmin) {
      // Admin: use service role to tag any character
      const adminClient = createServiceRoleClient();
      const { data: character, error } = await adminClient
        .from('character_library')
        .update({ tags })
        .eq('id', id)
        .select('id, tags')
        .single();

      if (error) {
        console.error('Error updating character tags (admin):', error);
        return NextResponse.json(
          { error: 'Failed to update tags' },
          { status: 500 }
        );
      }

      if (!character) {
        return NextResponse.json(
          { error: 'Character not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, tags: character.tags });
    }

    // Regular user: RLS ensures they can only update their own
    const { data: character, error } = await supabase
      .from('character_library')
      .update({ tags })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, tags')
      .single();

    if (error) {
      console.error('Error updating character tags:', error);
      return NextResponse.json(
        { error: 'Failed to update tags' },
        { status: 500 }
      );
    }

    if (!character) {
      return NextResponse.json(
        { error: 'Character not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, tags: character.tags });
  } catch (err) {
    console.error('Unexpected error in character tags API:', err);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
