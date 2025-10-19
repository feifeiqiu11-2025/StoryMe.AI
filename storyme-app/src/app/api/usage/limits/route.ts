/**
 * Usage Limits API
 * GET /api/usage/limits - Get current usage and limits for authenticated user
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserUsage } from '@/lib/utils/rate-limit';

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

    const usage = await getUserUsage(user.id);

    if (!usage) {
      return NextResponse.json(
        { error: 'Unable to fetch usage data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      usage,
    });
  } catch (error) {
    console.error('Error fetching usage limits:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
