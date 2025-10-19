/**
 * API Route: Public Testimonials
 * GET /api/testimonials
 * Returns top testimonials for landing page display
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET(request: NextRequest) {
  try {
    // Use service role client to bypass RLS for public testimonials
    const supabase = createServiceRoleClient();

    // Fetch top 3 five-star public testimonials
    // Prioritize: featured > rating > newest
    const { data: testimonials, error } = await supabase
      .from('user_feedback')
      .select('id, rating, feedback_text, display_name, created_at, is_featured')
      .eq('is_public', true)
      .gte('rating', 4) // Only show 4 and 5 star reviews
      .order('is_featured', { ascending: false }) // Featured first
      .order('rating', { ascending: false }) // Then by rating
      .order('created_at', { ascending: false }) // Then by newest
      .limit(3);

    if (error) {
      console.error('Error fetching testimonials:', error);
      return NextResponse.json(
        { error: 'Failed to fetch testimonials' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      testimonials: testimonials || [],
      count: testimonials?.length || 0,
    });

  } catch (error) {
    console.error('Error in testimonials API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
