/**
 * Marketing email opt-out check utility.
 *
 * Queries the email_preferences table and returns opted-out emails
 * so marketing sends can filter them out.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/** Returns a Set of emails (lowercase) that have opted out of marketing emails. */
export async function getOptedOutEmails(
  emails: string[],
  supabase: SupabaseClient,
): Promise<Set<string>> {
  if (emails.length === 0) return new Set();

  const lowered = emails.map(e => e.trim().toLowerCase());

  const { data } = await supabase
    .from('email_preferences')
    .select('email')
    .eq('marketing_opt_out', true)
    .in('email', lowered);

  return new Set((data || []).map((row: { email: string }) => row.email.toLowerCase()));
}

/** Check if a single email has opted out. */
export async function isEmailOptedOut(
  email: string,
  supabase: SupabaseClient,
): Promise<boolean> {
  const { data } = await supabase
    .from('email_preferences')
    .select('marketing_opt_out')
    .eq('email', email.trim().toLowerCase())
    .single();

  return data?.marketing_opt_out === true;
}
