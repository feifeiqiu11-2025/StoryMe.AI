/**
 * Admin API: Send Welcome Email (Test)
 *
 * POST /api/admin/send-welcome-email
 * Body: { mode: 'test', to?: string, firstName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email/welcome-email';

export async function POST(req: NextRequest) {
  const { mode, to, firstName } = await req.json();

  if (mode === 'test') {
    const recipient = to || 'feifei_qiu@hotmail.com';
    const name = firstName || 'there';

    await sendWelcomeEmail({ email: recipient, firstName: name });

    return NextResponse.json({ success: true, mode: 'test', sentTo: recipient });
  }

  return NextResponse.json({ success: false, error: 'Invalid mode. Use "test".' }, { status: 400 });
}
