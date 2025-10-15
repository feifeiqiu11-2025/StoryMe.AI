import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();

    // Get current authenticated user from Supabase Auth
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json({
        success: false,
        error: 'Not authenticated',
        authError
      });
    }

    // Check if user exists in users table
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .single();

    // Also check auth.users (Supabase's internal auth table)
    const { data: { users: allAuthUsers }, error: listError } = await supabase.auth.admin.listUsers();

    return NextResponse.json({
      success: true,
      authUser: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
        metadata: authUser.user_metadata
      },
      existsInUsersTable: !!dbUser,
      dbUser: dbUser,
      dbError: dbError?.message,
      totalAuthUsers: allAuthUsers?.length || 0,
      allAuthUsersEmails: allAuthUsers?.map(u => u.email) || []
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
