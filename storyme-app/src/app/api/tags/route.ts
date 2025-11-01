/**
 * Tags API
 * GET /api/tags - Fetch all available story tags
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Fetch all tags ordered by display_order
    const { data: tags, error } = await supabase
      .from('story_tags')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    // Transform to camelCase for frontend
    const transformedTags = tags?.map(tag => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      icon: tag.icon,
      displayOrder: tag.display_order,
      createdAt: tag.created_at,
    })) || [];

    return NextResponse.json({ tags: transformedTags });
  } catch (error) {
    console.error('Tags API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
