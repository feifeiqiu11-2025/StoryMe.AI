/**
 * Email Unsubscribe API
 *
 * GET  /api/email/unsubscribe?token=xxx — browser click from email link
 * POST /api/email/unsubscribe?token=xxx — RFC 8058 one-click (Gmail/Outlook native button)
 *
 * No authentication required — the HMAC token itself is the authorization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyUnsubscribeToken } from '@/lib/email/unsubscribe-token';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

async function processUnsubscribe(token: string | null): Promise<'success' | 'already' | 'error'> {
  if (!token) return 'error';

  const { valid, email } = verifyUnsubscribeToken(token);
  if (!valid || !email) return 'error';

  const supabase = createServiceRoleClient();

  // Upsert: if email exists, set opt-out; if not, create row with opt-out
  const { error } = await supabase
    .from('email_preferences')
    .upsert(
      {
        email,
        marketing_opt_out: true,
        marketing_opt_out_at: new Date().toISOString(),
      },
      { onConflict: 'email' },
    );

  if (error) {
    console.error('[UNSUBSCRIBE] DB error:', error.message);
    return 'error';
  }

  console.log(`[UNSUBSCRIBE] Opted out: ${email}`);
  return 'success';
}

/** GET — user clicks unsubscribe link in email */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const status = await processUnsubscribe(token);

  // Redirect to confirmation page (always same page regardless of email existence)
  const baseUrl = req.nextUrl.origin;
  return NextResponse.redirect(`${baseUrl}/unsubscribed?status=${status}`);
}

/** POST — RFC 8058 one-click unsubscribe (Gmail/Outlook native button) */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const status = await processUnsubscribe(token);

  if (status === 'error') {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  // RFC 8058: return 200 with empty body on success
  return new NextResponse(null, { status: 200 });
}
