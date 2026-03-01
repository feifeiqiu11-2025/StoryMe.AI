/**
 * Workshop Availability API
 * GET /api/v1/workshops/availability?partnerId=steamoji
 *
 * Returns registration counts per session per session-type.
 * Client computes spots remaining using capacity from constants.
 * No authentication required — availability is public info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { WORKSHOP_PARTNERS } from '@/lib/workshops/constants';
import type { SessionCounts } from '@/lib/workshops/types';

export async function GET(request: NextRequest) {
  try {
    const partnerId = request.nextUrl.searchParams.get('partnerId');

    if (!partnerId) {
      return NextResponse.json(
        { success: false, error: 'partnerId query parameter is required' },
        { status: 400 },
      );
    }

    // Validate partner exists and is active
    const partner = WORKSHOP_PARTNERS.find((p) => p.id === partnerId);
    if (!partner || partner.comingSoon) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unavailable partner' },
        { status: 404 },
      );
    }

    const supabase = createServiceRoleClient();

    // Fetch counts for both session types in parallel
    const [morningResult, afternoonResult] = await Promise.all([
      supabase.rpc('get_workshop_registration_counts', {
        p_partner_id: partnerId,
        p_session_type: 'morning',
      }),
      supabase.rpc('get_workshop_registration_counts', {
        p_partner_id: partnerId,
        p_session_type: 'afternoon',
      }),
    ]);

    if (morningResult.error || afternoonResult.error) {
      console.error(
        '[AVAILABILITY] RPC error:',
        morningResult.error || afternoonResult.error,
      );
      return NextResponse.json(
        { success: false, error: 'Failed to fetch availability' },
        { status: 500 },
      );
    }

    // Initialize all sessions with zero counts
    const counts: Record<string, SessionCounts> = {};
    for (const session of partner.sessions) {
      counts[session.id] = { morning: 0, afternoon: 0 };
    }

    // Fill in morning counts
    for (const row of morningResult.data || []) {
      if (counts[row.workshop_id]) {
        counts[row.workshop_id].morning = Number(row.registration_count);
      }
    }

    // Fill in afternoon counts
    for (const row of afternoonResult.data || []) {
      if (counts[row.workshop_id]) {
        counts[row.workshop_id].afternoon = Number(row.registration_count);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        partnerId,
        counts,
        queriedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[AVAILABILITY] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
