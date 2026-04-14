/**
 * Admin API: Manage custom story tags
 * POST /api/admin/custom-tags   - Create a new custom tag
 * DELETE /api/admin/custom-tags - Delete a custom tag
 *
 * Custom tags are inserted into story_tags with category='custom'
 * and parent_id pointing to the "Custom" parent row.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isAdminEmail } from '@/lib/auth/isAdmin';

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  if (!isAdminEmail(user.email)) return null;
  return user;
}

function slugify(text: string): string {
  return 'custom-' + text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name (string) is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 50) {
      return NextResponse.json({ error: 'Tag name must be 1-50 characters' }, { status: 400 });
    }

    const adminClient = createServiceRoleClient();

    // Find the Custom parent tag
    const { data: customParent, error: parentError } = await adminClient
      .from('story_tags')
      .select('id')
      .eq('slug', 'custom')
      .single();

    if (parentError || !customParent) {
      console.error('Custom parent tag not found:', parentError);
      return NextResponse.json({ error: 'Custom tag category not found. Run migration first.' }, { status: 500 });
    }

    const slug = slugify(trimmedName);

    // Check for duplicate slug
    const { data: existing } = await adminClient
      .from('story_tags')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'A tag with this name already exists' }, { status: 409 });
    }

    // Get max display_order among custom tags for ordering
    const { data: maxOrderResult } = await adminClient
      .from('story_tags')
      .select('display_order')
      .eq('category', 'custom')
      .eq('is_leaf', true)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = (maxOrderResult?.display_order ?? 30) + 1;

    const { data: newTag, error: insertError } = await adminClient
      .from('story_tags')
      .insert({
        name: trimmedName,
        slug,
        category: 'custom',
        parent_id: customParent.id,
        is_leaf: true,
        display_order: nextOrder,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating custom tag:', insertError);
      return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      tag: {
        id: newTag.id,
        name: newTag.name,
        slug: newTag.slug,
        category: newTag.category,
        parentId: newTag.parent_id,
        isLeaf: newTag.is_leaf,
        displayOrder: newTag.display_order,
        createdAt: newTag.created_at,
      },
    });
  } catch (err) {
    console.error('Unexpected error in custom-tags POST:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const user = await verifyAdmin(supabase);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - Admin access only' }, { status: 403 });
    }

    const body = await request.json();
    const { tagId } = body;

    if (!tagId || typeof tagId !== 'string') {
      return NextResponse.json({ error: 'tagId (string) is required' }, { status: 400 });
    }

    const adminClient = createServiceRoleClient();

    // Verify this is a custom tag (safety: prevent deleting predefined tags)
    const { data: tag, error: tagError } = await adminClient
      .from('story_tags')
      .select('id, category, is_leaf')
      .eq('id', tagId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 });
    }

    if (tag.category !== 'custom' || !tag.is_leaf) {
      return NextResponse.json({ error: 'Can only delete custom leaf tags' }, { status: 400 });
    }

    // Delete the tag (project_tags cascade will clean up references)
    const { error: deleteError } = await adminClient
      .from('story_tags')
      .delete()
      .eq('id', tagId);

    if (deleteError) {
      console.error('Error deleting custom tag:', deleteError);
      return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unexpected error in custom-tags DELETE:', err);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
