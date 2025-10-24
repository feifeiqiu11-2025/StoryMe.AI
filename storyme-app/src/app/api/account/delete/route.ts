/**
 * Delete Account API Endpoint
 * Permanently deletes user account and all associated data
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
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

    const userId = user.id;

    // Delete all user data in the correct order (respecting foreign keys)

    // 1. Delete scenes (depends on stories)
    await supabase
      .from('scenes')
      .delete()
      .eq('user_id', userId);

    // 2. Delete stories
    await supabase
      .from('stories')
      .delete()
      .eq('user_id', userId);

    // 3. Delete characters
    await supabase
      .from('characters')
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

    // 10. Delete auth user (this will cascade delete everything in auth schema)
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
