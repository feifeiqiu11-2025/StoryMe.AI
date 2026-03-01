/**
 * Test Email Endpoint (DEV ONLY)
 * GET /api/test-email?to=your@email.com&session=morning
 *
 * Sends a sample workshop confirmation email for previewing.
 * Remove this file before production or protect with auth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendWorkshopConfirmationEmail } from '@/lib/email/workshop-confirmation';

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get('to');
  const sessionType = (request.nextUrl.searchParams.get('session') || 'morning') as 'morning' | 'afternoon';

  if (!to) {
    return NextResponse.json(
      { error: 'Missing "to" query param. Usage: /api/test-email?to=you@email.com&session=morning' },
      { status: 400 },
    );
  }

  await sendWorkshopConfirmationEmail({
    parentFirstName: 'Sarah',
    parentLastName: 'Johnson',
    parentEmail: to,
    childFirstName: 'Emma',
    childLastName: 'Johnson',
    childAge: sessionType === 'morning' ? 5 : 8,
    partnerId: 'steamoji',
    selectedSessionType: sessionType,
    selectedWorkshopIds:
      sessionType === 'morning'
        ? ['steamoji-wk1', 'steamoji-wk2', 'steamoji-wk3']
        : ['steamoji-wk1', 'steamoji-wk2', 'steamoji-wk3', 'steamoji-wk4', 'steamoji-wk5'],
    amountPaid: sessionType === 'morning' ? 12000 : 30000,
  });

  return NextResponse.json({
    success: true,
    message: `Test ${sessionType} confirmation email sent to ${to}`,
  });
}
