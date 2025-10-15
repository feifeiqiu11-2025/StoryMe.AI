import { createClient } from './supabase/server';

/**
 * Ensure user exists in the users table
 * Creates a user record if it doesn't exist
 */
export async function ensureUserExists(userId: string, email?: string, name?: string) {
  const supabase = await createClient();

  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .single();

  if (existingUser) {
    return { success: true, created: false };
  }

  // Create user if doesn't exist
  const { error } = await supabase
    .from('users')
    .insert([{
      id: userId,
      email: email || `user-${userId}@storyme.app`,
      name: name || 'StoryMe User',
      subscription_tier: 'free'
    }]);

  if (error) {
    console.error('Error creating user:', error);
    return { success: false, error };
  }

  return { success: true, created: true };
}
