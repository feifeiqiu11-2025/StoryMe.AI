/**
 * Webhook: Send Welcome Email on User Signup
 *
 * POST /api/auth/welcome-email
 *
 * Triggered by Supabase Database Webhook on INSERT into the `users` table.
 * Verifies the webhook secret, extracts user data, sends welcome email,
 * and updates `welcome_email_sent_at` for observability.
 *
 * Supabase webhook payload format:
 * {
 *   type: "INSERT",
 *   table: "users",
 *   schema: "public",
 *   record: { id, email, name, ... },
 *   old_record: null
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/email/welcome-email';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  // Verify webhook secret
  const authHeader = req.headers.get('authorization');
  if (!WEBHOOK_SECRET || authHeader !== `Bearer ${WEBHOOK_SECRET}`) {
    console.error('[WELCOME-EMAIL] Unauthorized webhook call');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await req.json();

    // Validate payload structure
    if (payload.type !== 'INSERT' || payload.table !== 'users') {
      return NextResponse.json({ skipped: true, reason: 'Not a users INSERT event' });
    }

    const record = payload.record;
    if (!record?.email) {
      console.error('[WELCOME-EMAIL] No email in webhook payload');
      return NextResponse.json({ error: 'Missing email in record' }, { status: 400 });
    }

    // Extract first name from the name field
    const fullName: string = record.name || '';
    const firstName = fullName.split(' ')[0] || 'there';

    // Send welcome email (non-blocking error handling inside)
    await sendWelcomeEmail({
      email: record.email,
      firstName,
    });

    // Update welcome_email_sent_at for observability
    const { error: updateError } = await getSupabase()
      .from('users')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', record.id);

    if (updateError) {
      console.error('[WELCOME-EMAIL] Failed to update welcome_email_sent_at:', updateError);
      // Non-fatal — email was already sent
    }

    return NextResponse.json({ success: true, email: record.email });
  } catch (error) {
    console.error('[WELCOME-EMAIL] Webhook handler error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
