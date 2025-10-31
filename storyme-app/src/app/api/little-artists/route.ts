/**
 * Little Artists API Routes
 * GET  /api/little-artists - List artists (public or parent's own)
 * POST /api/little-artists - Create new artist profile (premium only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { LittleArtist, CreateArtistInput } from '@/lib/types/artist';

/**
 * GET /api/little-artists
 * Query params:
 * - status: filter by status (public route only shows 'published')
 * - parent_user_id: filter by parent (only if authenticated as that parent)
 * - featured: boolean
 * - limit: number (default 50)
 * - offset: number (default 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const searchParams = request.nextUrl.searchParams;

    // Get authenticated user (optional for public routes)
    const { data: { user } } = await supabase.auth.getUser();

    // Build query
    let query = supabase
      .from('little_artists')
      .select('*');

    // If not authenticated or not requesting own artists, only show published
    const parentUserId = searchParams.get('parent_user_id');
    if (!user || !parentUserId || parentUserId !== user.id) {
      query = query.eq('status', 'published');
    } else if (parentUserId === user.id) {
      // Parent viewing their own artists - show all
      query = query.eq('parent_user_id', user.id);
    }

    // Apply filters
    const status = searchParams.get('status');
    if (status && user && parentUserId === user.id) {
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
      .order('featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    const { data: artists, error, count } = await query;

    if (error) {
      console.error('Error fetching artists:', error);
      return NextResponse.json(
        { error: 'Failed to fetch artists' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      artists: artists || [],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/little-artists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/little-artists
 * Create new artist profile
 * Premium feature only
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Authentication required
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Check subscription tier - premium only
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      console.error('Error fetching user data:', userError);
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

    // 3. Parse and validate input
    const body: CreateArtistInput = await request.json();

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Artist name is required' },
        { status: 400 }
      );
    }

    if (body.age && (body.age < 3 || body.age > 18)) {
      return NextResponse.json(
        { error: 'Age must be between 3 and 18' },
        { status: 400 }
      );
    }

    // 4. Check artist limit (max 3 per parent) - enforced by DB trigger
    const { count } = await supabase
      .from('little_artists')
      .select('*', { count: 'exact', head: true })
      .eq('parent_user_id', user.id)
      .neq('status', 'archived');

    if (count && count >= 3) {
      return NextResponse.json(
        {
          error: 'Artist limit reached',
          message: 'Maximum 3 artist profiles per account',
          current: count,
        },
        { status: 400 }
      );
    }

    // 5. Create artist profile
    const { data: artist, error: createError } = await supabase
      .from('little_artists')
      .insert({
        parent_user_id: user.id,
        name: body.name.trim(),
        age: body.age,
        bio: body.bio?.trim(),
        profile_photo_url: body.profile_photo_url,
        status: 'draft', // Always start as draft
        parent_consent_given: false,
        featured: false,
        display_order: 0,
        artworks_count: 0,
        character_usage_count: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating artist:', createError);

      // Check if it's the trigger constraint
      if (createError.message?.includes('Maximum 3 artist profiles')) {
        return NextResponse.json(
          {
            error: 'Artist limit reached',
            message: 'Maximum 3 artist profiles per account',
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Failed to create artist profile' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        artist,
        message: 'Artist profile created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Unexpected error in POST /api/little-artists:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
