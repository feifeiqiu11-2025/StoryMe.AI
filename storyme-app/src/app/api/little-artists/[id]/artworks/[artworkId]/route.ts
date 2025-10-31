/**
 * Individual Artwork API Routes
 * DELETE /api/little-artists/[id]/artworks/[artworkId] - Delete an artwork
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * DELETE /api/little-artists/[id]/artworks/[artworkId]
 * Delete an artwork (owner only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; artworkId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId, artworkId } = await params;

    // 1. Authentication required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check artist ownership
    const { data: artist, error: artistError } = await supabase
      .from('little_artists')
      .select('parent_user_id')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
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

    // 3. Get artwork to check existence and get image URLs for cleanup
    const { data: artwork, error: artworkError } = await supabase
      .from('artist_artworks')
      .select('id, original_sketch_url, animated_version_url, artist_id')
      .eq('id', artworkId)
      .eq('artist_id', artistId)
      .single();

    if (artworkError || !artwork) {
      return NextResponse.json(
        { error: 'Artwork not found' },
        { status: 404 }
      );
    }

    // 4. Delete images from storage
    const imagesToDelete: string[] = [];

    // Extract file paths from URLs
    if (artwork.original_sketch_url) {
      const sketchPath = extractStoragePath(artwork.original_sketch_url);
      if (sketchPath) imagesToDelete.push(sketchPath);
    }

    if (artwork.animated_version_url) {
      const transformedPath = extractStoragePath(artwork.animated_version_url);
      if (transformedPath) imagesToDelete.push(transformedPath);
    }

    // Delete images from storage bucket
    if (imagesToDelete.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('little-artists')
        .remove(imagesToDelete);

      if (storageError) {
        console.error('Error deleting images from storage:', storageError);
        // Continue with database deletion even if storage cleanup fails
      }
    }

    // 5. Delete artwork record from database
    const { error: deleteError } = await supabase
      .from('artist_artworks')
      .delete()
      .eq('id', artworkId)
      .eq('artist_id', artistId); // Double-check ownership

    if (deleteError) {
      console.error('Error deleting artwork:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete artwork' },
        { status: 500 }
      );
    }

    // Note: The database trigger will automatically update little_artists.artworks_count

    return NextResponse.json({
      success: true,
      message: 'Artwork deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/little-artists/[id]/artworks/[artworkId]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Extract storage path from Supabase storage URL
 * Example: https://.../storage/v1/object/public/little-artists/user123/artwork456.jpg
 * Returns: user123/artwork456.jpg
 */
function extractStoragePath(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Find 'little-artists' bucket in path
    const bucketIndex = pathParts.indexOf('little-artists');
    if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
      return null;
    }

    // Return everything after the bucket name
    return pathParts.slice(bucketIndex + 1).join('/');
  } catch (error) {
    console.error('Error parsing storage URL:', error);
    return null;
  }
}
