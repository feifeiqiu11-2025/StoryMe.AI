/**
 * Usage Limits API
 * GET /api/usage/limits - Get current usage and limits for authenticated user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkStoryCreationLimit } from '@/lib/subscription/middleware';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Use checkStoryCreationLimit to get proper canCreate status
    const limitCheck = await checkStoryCreationLimit(user.id);

    return NextResponse.json(limitCheck);
  } catch (error) {
    console.error('Error fetching usage limits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
