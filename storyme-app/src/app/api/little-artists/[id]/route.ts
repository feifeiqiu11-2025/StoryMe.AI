/**
 * Little Artist Detail API Routes
 * GET    /api/little-artists/[id] - Get artist details
 * PATCH  /api/little-artists/[id] - Update artist
 * DELETE /api/little-artists/[id] - Delete/archive artist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UpdateArtistInput } from '@/lib/types/artist';

/**
 * GET /api/little-artists/[id]
 * Fetch single artist with optional artworks
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeArtworks = searchParams.get('include_artworks') === 'true';

    // Get authenticated user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch artist
    const { data: artist, error: artistError } = await supabase
      .from('little_artists')
      .select('*')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Check access permissions
    const isOwner = user && artist.parent_user_id === user.id;
    const isPublished = artist.status === 'published';

    if (!isOwner && !isPublished) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Optionally fetch artworks
    let artworks = null;
    if (includeArtworks) {
      let artworkQuery = supabase
        .from('artist_artworks')
        .select('*')
        .eq('artist_id', artistId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

      // Only show published artworks to non-owners
      if (!isOwner) {
        artworkQuery = artworkQuery.eq('status', 'published');
      }

      const { data: artworkData } = await artworkQuery;
      artworks = artworkData || [];
    }

    return NextResponse.json({
      artist,
      artworks,
    });
  } catch (error) {
    console.error('Error in GET /api/little-artists/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/little-artists/[id]
 * Update artist profile (parent only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;

    // 1. Authentication required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check ownership
    const { data: artist, error: fetchError } = await supabase
      .from('little_artists')
      .select('parent_user_id, status')
      .eq('id', artistId)
      .single();

    if (fetchError || !artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    if (artist.parent_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 3. Parse and validate input
    const body: UpdateArtistInput = await request.json();

    // Build update object
    const updates: any = {};

    if (body.name !== undefined) {
      if (!body.name.trim()) {
        return NextResponse.json(
          { error: 'Name cannot be empty' },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.age !== undefined) {
      if (body.age < 3 || body.age > 18) {
        return NextResponse.json(
          { error: 'Age must be between 3 and 18' },
          { status: 400 }
        );
      }
      updates.age = body.age;
    }

    if (body.bio !== undefined) {
      updates.bio = body.bio?.trim() || null;
    }

    if (body.profile_photo_url !== undefined) {
      updates.profile_photo_url = body.profile_photo_url || null;
    }

    if (body.status !== undefined) {
      // Status changes have restrictions
      const allowedStatuses = ['draft', 'pending_review', 'archived'];

      // Parents can't directly publish - must go through review
      if (body.status === 'published') {
        return NextResponse.json(
          { error: 'Cannot directly publish. Request review first.' },
          { status: 400 }
        );
      }

      if (!allowedStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        );
      }

      updates.status = body.status;
    }

    if (body.featured !== undefined) {
      updates.featured = body.featured;
    }

    if (body.display_order !== undefined) {
      updates.display_order = body.display_order;
    }

    // 4. Update artist
    const { data: updatedArtist, error: updateError } = await supabase
      .from('little_artists')
      .update(updates)
      .eq('id', artistId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating artist:', updateError);
      return NextResponse.json(
        { error: 'Failed to update artist' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      artist: updatedArtist,
      message: 'Artist updated successfully',
    });
  } catch (error) {
    console.error('Error in PATCH /api/little-artists/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/little-artists/[id]
 * Archive artist (soft delete)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;

    // 1. Authentication required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check ownership
    const { data: artist, error: fetchError } = await supabase
      .from('little_artists')
      .select('parent_user_id')
      .eq('id', artistId)
      .single();

    if (fetchError || !artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    if (artist.parent_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    // 3. Soft delete - archive the artist
    const { error: updateError } = await supabase
      .from('little_artists')
      .update({ status: 'archived' })
      .eq('id', artistId);

    if (updateError) {
      console.error('Error archiving artist:', updateError);
      return NextResponse.json(
        { error: 'Failed to archive artist' },
        { status: 500 }
      );
    }

    // Also archive all artworks
    await supabase
      .from('artist_artworks')
      .update({ status: 'archived' })
      .eq('artist_id', artistId);

    return NextResponse.json({
      success: true,
      message: 'Artist archived successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/little-artists/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
