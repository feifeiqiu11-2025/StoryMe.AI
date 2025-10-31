/**
 * Artist Artworks API Routes
 * GET  /api/little-artists/[id]/artworks - List artworks for an artist
 * POST /api/little-artists/[id]/artworks - Create new artwork (initiates transformation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CreateArtworkInput } from '@/lib/types/artist';

/**
 * GET /api/little-artists/[id]/artworks
 * List artworks for an artist
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: artistId } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Get authenticated user (optional)
    const { data: { user } } = await supabase.auth.getUser();

    // Check if artist exists and get ownership info
    const { data: artist, error: artistError } = await supabase
      .from('little_artists')
      .select('parent_user_id, status')
      .eq('id', artistId)
      .single();

    if (artistError || !artist) {
      return NextResponse.json(
        { error: 'Artist not found' },
        { status: 404 }
      );
    }

    // Build query
    let query = supabase
      .from('artist_artworks')
      .select('*')
      .eq('artist_id', artistId);

    // Access control: only owner can see all artworks
    const isOwner = user && artist.parent_user_id === user.id;
    if (!isOwner) {
      // Public users only see published artworks from published artists
      if (artist.status !== 'published') {
        return NextResponse.json({ artworks: [], total: 0 });
      }
      query = query.eq('status', 'published');
    }

    // Apply filters
    const status = searchParams.get('status');
    if (status && isOwner) {
      query = query.eq('status', status);
    }

    const featured = searchParams.get('featured');
    if (featured === 'true') {
      query = query.eq('featured', true);
    }

    // Pagination
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    query = query
      .range(offset, offset + limit - 1)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    const { data: artworks, error, count } = await query;

    if (error) {
      console.error('Error fetching artworks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch artworks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      artworks: artworks || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Error in GET /api/little-artists/[id]/artworks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/little-artists/[id]/artworks
 * Create new artwork record (sketch upload complete, ready for transformation)
 * The actual transformation happens in /api/transform-sketch
 */
export async function POST(
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

    // 2. Check premium subscription
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Failed to verify subscription' },
        { status: 500 }
      );
    }

    if (!['basic', 'premium', 'team'].includes(userData.subscription_tier)) {
      return NextResponse.json(
        {
          error: 'Premium subscription required',
          message: 'Little Artists feature is available for premium subscribers only',
          upgradeUrl: '/upgrade',
        },
        { status: 403 }
      );
    }

    // 3. Check ownership
    const { data: artist, error: artistError } = await supabase
      .from('little_artists')
      .select('parent_user_id, artworks_count')
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

    // 4. Check artwork limit (20 max per artist)
    const { count } = await supabase
      .from('artist_artworks')
      .select('*', { count: 'exact', head: true })
      .eq('artist_id', artistId)
      .neq('status', 'archived');

    if (count && count >= 20) {
      return NextResponse.json(
        {
          error: 'Artwork limit reached',
          message: 'Maximum 20 artworks per artist',
          current: count,
        },
        { status: 400 }
      );
    }

    // 5. Parse and validate input
    const body: CreateArtworkInput = await request.json();

    if (!body.original_sketch_url) {
      return NextResponse.json(
        { error: 'Sketch URL is required' },
        { status: 400 }
      );
    }

    if (!body.transformation_style) {
      return NextResponse.json(
        { error: 'Transformation style is required' },
        { status: 400 }
      );
    }

    const validStyles = ['sketch-to-character', 'cartoon', 'watercolor', 'realistic'];
    if (!validStyles.includes(body.transformation_style)) {
      return NextResponse.json(
        { error: 'Invalid transformation style' },
        { status: 400 }
      );
    }

    // 6. Create artwork record
    const { data: artwork, error: createError } = await supabase
      .from('artist_artworks')
      .insert({
        artist_id: artistId,
        original_sketch_url: body.original_sketch_url,
        original_sketch_filename: body.original_sketch_filename,
        character_name: body.character_name?.trim() || null,
        transformation_style: body.transformation_style,
        title: body.title?.trim() || null,
        description: body.description?.trim() || null,
        status: 'draft', // Will be updated after transformation
        featured: false,
        display_order: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating artwork:', createError);

      // Check if it's the trigger constraint
      if (createError.message?.includes('Maximum 20 artworks')) {
        return NextResponse.json(
          {
            error: 'Artwork limit reached',
            message: 'Maximum 20 artworks per artist',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create artwork' },
        { status: 500 }
      );
    }

    // 7. If share_to_library is enabled, create character_library entry
    let characterLibraryId: string | null = null;
    if (body.share_to_library) {
      console.log('Creating character library entry for artwork:', artwork.id);

      const { data: characterData, error: charError } = await supabase
        .from('character_library')
        .insert({
          user_id: user.id,
          name: body.character_name?.trim() || 'Untitled Character',
          description: body.description?.trim() || null,
          image_url: body.original_sketch_url, // Will be updated with animated version later
          source_type: 'artist_community',
          artist_id: artistId,
          artwork_id: artwork.id,
          is_public: false, // Stays private until artist profile is published
        })
        .select('id')
        .single();

      if (charError) {
        console.error('Error creating character library entry:', charError);
        // Don't fail the whole request, just log the error
      } else if (characterData) {
        characterLibraryId = characterData.id;

        // Update artwork with character_library_id link
        await supabase
          .from('artist_artworks')
          .update({ character_library_id: characterLibraryId })
          .eq('id', artwork.id);

        console.log('✓ Character library entry created:', characterLibraryId);
      }
    }

    return NextResponse.json(
      {
        success: true,
        artwork: {
          ...artwork,
          character_library_id: characterLibraryId,
        },
        message: 'Artwork created successfully. Ready for transformation.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/little-artists/[id]/artworks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
