/**
 * Test endpoint for Phase 2A subscription system
 * GET /api/test-subscription
 *
 * Tests:
 * 1. User subscription status
 * 2. Story creation limits
 * 3. Database functions
 */

import { createClient } from '@/lib/supabase/server';
import { checkStoryCreationLimit, getSubscriptionSummary } from '@/lib/subscription/middleware';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Test 1: Get user's subscription data from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        email,
        subscription_tier,
        subscription_status,
        trial_started_at,
        trial_ends_at,
        stories_created_this_month,
        stories_limit,
        billing_cycle_start,
        stripe_customer_id,
        team_id,
        is_team_primary
      `)
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json(
        { error: 'Failed to fetch user data', details: userError },
        { status: 500 }
      );
    }

    // Test 2: Check if user can create a story
    const storyCreationStatus = await checkStoryCreationLimit(user.id);

    // Test 3: Get subscription summary
    const subscriptionSummary = await getSubscriptionSummary(user.id);

    // Test 4: Test database function (can_create_story)
    const { data: canCreateStoryResult, error: functionError } = await supabase
      .rpc('can_create_story', { p_user_id: user.id });

    // Calculate trial days remaining manually
    let trialDaysRemaining = null;
    if (userData.trial_ends_at) {
      const trialEnd = new Date(userData.trial_ends_at);
      const now = new Date();
      const diffTime = trialEnd.getTime() - now.getTime();
      trialDaysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Return comprehensive test results
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tests: {
        databaseQuery: {
          passed: !!userData,
          data: userData,
        },
        storyCreationLimit: {
          passed: true,
          canCreate: storyCreationStatus.canCreate,
          reason: storyCreationStatus.reason,
          data: storyCreationStatus,
        },
        subscriptionSummary: {
          passed: !!subscriptionSummary,
          data: subscriptionSummary,
        },
        databaseFunction: {
          passed: !functionError,
          canCreateStory: canCreateStoryResult,
          error: functionError,
        },
      },
      summary: {
        tier: userData.subscription_tier,
        status: userData.subscription_status,
        storiesUsed: userData.stories_created_this_month,
        storiesLimit: userData.stories_limit,
        storiesRemaining: userData.stories_limit === -1
          ? 'Unlimited'
          : Math.max(0, userData.stories_limit - userData.stories_created_this_month),
        trialDaysRemaining,
        canCreateStory: storyCreationStatus.canCreate,
        hasStripeCustomer: !!userData.stripe_customer_id,
        isTeamMember: !!userData.team_id,
      },
      message: storyCreationStatus.canCreate
        ? '✓ Everything looks good! You can create stories.'
        : `✗ Cannot create stories: ${storyCreationStatus.reason}`,
    });
  } catch (error) {
    console.error('Test subscription error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
