/**
 * Delete Account API Endpoint
 * Permanently deletes user account and all associated data
 */

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    // Get auth token from Authorization header (for cross-app requests)
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    // Use service role client to validate token and get user
    const serviceRoleClient = createServiceRoleClient();

    let user;
    let userId;

    if (token) {
      // Authenticate using bearer token from Kids app
      const { data: { user: tokenUser }, error: tokenError } =
        await serviceRoleClient.auth.getUser(token);

      if (tokenError || !tokenUser) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      user = tokenUser;
      userId = tokenUser.id;
    } else {
      // Fall back to cookie-based auth for Studio app web UI
      const supabase = await createClient();
      const { data: { user: cookieUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !cookieUser) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        );
      }
      user = cookieUser;
      userId = cookieUser.id;
    }

    // Use service role client for all deletions
    const supabase = serviceRoleClient;

    // Delete all user data in the correct order (respecting foreign keys)

    // 1. Delete scenes (CASCADE from projects, but delete manually for clarity)
    // Note: scenes table has no user_id, only project_id
    // We need to delete via projects first, or let CASCADE handle it
    const { data: userProjects } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId);

    if (userProjects && userProjects.length > 0) {
      const projectIds = userProjects.map(p => p.id);

      // Delete scenes for user's projects
      await supabase
        .from('scenes')
        .delete()
        .in('project_id', projectIds);
    }

    // 2. Delete projects (was called 'stories' incorrectly)
    await supabase
      .from('projects')
      .delete()
      .eq('user_id', userId);

    // 3. Delete characters from character library (was called 'characters' incorrectly)
    await supabase
      .from('character_library')
      .delete()
      .eq('user_id', userId);

    // 4. Delete publications (if exists)
    await supabase
      .from('publications')
      .delete()
      .eq('user_id', userId);

    // 5. Delete API usage logs (if exists)
    await supabase
      .from('api_usage_logs')
      .delete()
      .eq('user_id', userId);

    // 6. Delete privacy consent (if exists)
    await supabase
      .from('privacy_consent')
      .delete()
      .eq('user_id', userId);

    // 7. Delete user feedback (if exists)
    await supabase
      .from('user_feedback')
      .delete()
      .eq('user_id', userId);

    // 8. Delete child profiles (if exists)
    const { data: childProfiles } = await supabase
      .from('child_profiles')
      .select('id')
      .eq('parent_user_id', userId);

    if (childProfiles && childProfiles.length > 0) {
      const childProfileIds = childProfiles.map(cp => cp.id);

      // Delete reading progress for child profiles
      await supabase
        .from('reading_progress')
        .delete()
        .in('child_profile_id', childProfileIds);

      // Delete reading goals for child profiles
      await supabase
        .from('reading_goals')
        .delete()
        .in('child_profile_id', childProfileIds);

      // Delete child profiles
      await supabase
        .from('child_profiles')
        .delete()
        .eq('parent_user_id', userId);
    }

    // 9. Delete user record
    await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    // 10. Delete auth user (requires service role client with admin privileges)
    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('Error deleting auth user:', deleteAuthError);
      // Continue anyway as data is already deleted
    }

    return NextResponse.json(
      { success: true, message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
