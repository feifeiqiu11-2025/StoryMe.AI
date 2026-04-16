/**
 * Admin Metrics API
 * GET /api/admin/metrics
 *
 * Returns user registry, story leaderboard, and summary stats.
 * Restricted to admin emails.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { isAdminEmail } from '@/lib/auth/isAdmin';

export async function GET(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user || !isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = 50;
    const offset = (page - 1) * pageSize;

    const adminClient = createServiceRoleClient();

    // Fetch users with pagination (latest first)
    const [usersResult, totalResult, storiesResult, projectCountResult] = await Promise.all([
      // Paginated user list — select * to avoid column name mismatches
      adminClient
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1),

      // Total user count
      adminClient
        .from('users')
        .select('id', { count: 'exact', head: true }),

      // Story leaderboard: users ranked by total completed projects
      adminClient
        .from('projects')
        .select('user_id, status')
        .eq('status', 'completed'),

      // Total project count
      adminClient
        .from('projects')
        .select('id', { count: 'exact', head: true }),
    ]);

    if (usersResult.error) {
      console.error('Error fetching users:', usersResult.error);
      return NextResponse.json({ error: 'Failed to fetch users', details: usersResult.error.message }, { status: 500 });
    }

    // Build story count per user for leaderboard
    const storyCountByUser = new Map<string, number>();
    (storiesResult.data || []).forEach((p: any) => {
      storyCountByUser.set(p.user_id, (storyCountByUser.get(p.user_id) || 0) + 1);
    });

    // Build leaderboard (top 20)
    const leaderboard = Array.from(storyCountByUser.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    // Enrich leaderboard with user info
    const leaderboardUserIds = leaderboard.map(([id]) => id);
    let leaderboardUsers: any[] = [];
    if (leaderboardUserIds.length > 0) {
      const { data } = await adminClient
        .from('users')
        .select('*')
        .in('id', leaderboardUserIds);
      leaderboardUsers = data || [];
    }

    const enrichedLeaderboard = leaderboard.map(([userId, totalStories]) => {
      const u = leaderboardUsers.find((lu: any) => lu.id === userId);
      return {
        userId,
        name: u?.full_name || u?.name || 'Unknown',
        email: u?.email || '',
        totalStories,
        storiesThisMonth: u?.stories_created_this_month || 0,
        tier: u?.subscription_tier || 'unknown',
      };
    });

    // Summary stats
    const totalUsers = totalResult.count || 0;
    const totalProjects = projectCountResult.count || 0;
    const users = usersResult.data || [];

    const tierCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};

    // We need all users for summary — use a lightweight query
    const { data: allUsersSummary } = await adminClient
      .from('users')
      .select('*');

    (allUsersSummary || []).forEach((u: any) => {
      const tier = u.subscription_tier || 'unknown';
      const status = u.subscription_status || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const activeTrials = (allUsersSummary || []).filter(
      (u: any) => u.trial_status === 'active' || ((u.subscription_tier === 'trial' || u.subscription_tier === 'free') && u.subscription_status === 'trialing')
    ).length;

    return NextResponse.json({
      summary: {
        totalUsers,
        totalProjects,
        tierCounts,
        statusCounts,
        activeTrials,
      },
      users: users.map((u: any) => ({
        id: u.id,
        name: u.full_name || u.name || u.display_name || '',
        email: u.email || '',
        tier: u.subscription_tier || 'unknown',
        status: u.subscription_status || 'unknown',
        trialStatus: u.trial_status || null,
        trialStartedAt: u.trial_started_at || null,
        trialEndsAt: u.trial_ends_at || null,
        storiesThisMonth: u.stories_created_this_month || 0,
        storiesLimit: u.stories_limit || 0,
        createdAt: u.created_at,
      })),
      leaderboard: enrichedLeaderboard,
      pagination: {
        page,
        pageSize,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / pageSize),
      },
    });
  } catch (error) {
    console.error('Error in admin metrics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
