/**
 * Admin API: Send Workshop Reminder Emails
 *
 * POST /api/admin/send-workshop-reminder
 * Body: { mode: 'test' | 'send' }
 *
 * test: sends both morning + afternoon samples to feifei_qiu@hotmail.com
 * send: sends to all confirmed registrations for steamoji-wk1
 */

import { NextRequest, NextResponse } from 'next/server';
import { resend, EMAIL_FROM } from '@/lib/email/resend';
import { createClient } from '@supabase/supabase-js';

const REPLY_TO = 'Admin@KindleWoodStudio.ai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Morning Session Email ───────────────────────────────────────────────

function buildMorningReminderHtml(parentFirstName: string, childFirstName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #6d28d9; background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">
                This Sunday: Little Crafter &amp; Storyteller
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                KindleWood &times; SteamOji Workshop &middot; Week 1: Nature
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 24px 16px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                Hi ${parentFirstName},
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                We're looking forward to seeing <strong>${childFirstName}</strong> this Sunday for our first Creative Explorers Workshop! Here are the details for a smooth check-in.
              </p>
            </td>
          </tr>

          <!-- Session Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Session Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Session</strong><br />
                    <span style="color: #6b7280;">Little Crafter &amp; Storyteller (Ages 4&ndash;6) &middot; 10:00 &ndash; 11:00 AM</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Date</strong><br />
                    <span style="color: #6b7280;">Sunday, March 8, 2026</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Activity</strong><br />
                    <span style="color: #6b7280;">Nature Craft + Simple Story</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <strong style="color: #374151;">Check-in Location</strong><br />
                    <span style="color: #6b7280;">Steamoji Academy &ndash; Bellevue</span><br />
                    <span style="color: #6b7280;">14315 NE 20th St, Suite C&ndash;E, Bellevue, WA 98007</span><br />
                    <span style="color: #9ca3af; font-size: 13px; font-style: italic;">(Steamoji is at the very right side of the plaza, next to StretchLab)</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What to Bring -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                What to Bring
              </h2>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Comfortable clothes (may get messy from art projects)</li>
                <li>Water bottle</li>
                <li>Curiosity and creativity!</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                If you have any questions, simply reply to this email and we'll get back to you promptly.
              </p>
              <p style="color: #374151; font-size: 14px; margin: 16px 0 0; font-weight: 600;">
                See you Sunday!
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 8px 0 0;">
                &mdash; The KindleWood &times; SteamOji Team
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Afternoon Session Email ─────────────────────────────────────────────

function buildAfternoonReminderHtml(parentFirstName: string, childFirstName: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color: #6d28d9; background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">
                This Sunday: Nature Explorer + Creativity Lab
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                KindleWood &times; SteamOji Workshop &middot; Week 1: Nature
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 24px 16px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                Hi ${parentFirstName},
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                We're looking forward to seeing <strong>${childFirstName}</strong> this Sunday for our first Creative Explorers Workshop! Here are the details for a smooth check-in.
              </p>
            </td>
          </tr>

          <!-- Session Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Session Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Session</strong><br />
                    <span style="color: #6b7280;">Nature Explorer + Creativity Lab (Ages 7&ndash;9) &middot; 1:00 &ndash; 3:00 PM</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Date</strong><br />
                    <span style="color: #6b7280;">Sunday, March 8, 2026</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <strong style="color: #374151;">Activity</strong><br />
                    <span style="color: #6b7280;">Ecosystem Observation &rarr; Storybook</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Outdoor Check-in -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Outdoor Check-in Location
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef9f0; border: 1px solid #fde68a; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #374151; font-size: 15px;">Bridle Trails State Park</strong><br />
                    <span style="color: #92400e; font-size: 13px;">Discover Pass required, or purchase a daily pass for $10 at the park</span><br />
                    <a href="https://maps.app.goo.gl/7Y74Exbd3ZvFa3xS6" style="color: #2563eb; text-decoration: underline; font-size: 14px;">Open in Google Maps</a>
                  </td>
                </tr>
              </table>

              <div style="margin-top: 16px;">
                <p style="color: #374151; font-size: 14px; margin: 0; line-height: 1.7;">
                  <strong>Arrival Time:</strong> Please arrive by <strong>12:50 PM</strong> (10 minutes before start).<br />
                  Late check-in may not be accommodated, as we will begin promptly.
                </p>
              </div>
            </td>
          </tr>

          <!-- Parent Participation -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Parent Participation (Important)
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #7c3aed;">1:00 &ndash; 1:45 PM &middot; Nature Walk</strong><br />
                    <span style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                      Parents are encouraged to join the guided nature walk. This allows you to see how your child's real-world outdoor experience translates into their later structured indoor learning.
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #7c3aed;">1:45 PM &middot; Transition</strong><br />
                    <span style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                      We return to the trailhead. Parents drive children to the indoor location:<br />
                      <strong style="color: #374151;">Steamoji Academy &ndash; Bellevue</strong><br />
                      14315 NE 20th St, Suite C&ndash;E, Bellevue, WA 98007<br />
                      <span style="color: #9ca3af; font-size: 13px; font-style: italic;">(Steamoji is at the very right side of the plaza, next to StretchLab)</span>
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #7c3aed;">2:00 &ndash; 3:00 PM &middot; Indoor Session</strong><br />
                    <span style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                      Children participate independently &mdash; parents are not required to stay.
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px;">
                    <strong style="color: #7c3aed;">2:45 PM &middot; Mini Presentation</strong><br />
                    <span style="color: #6b7280; font-size: 14px; line-height: 1.6;">
                      We warmly encourage at least one parent to return by 2:45 PM to enjoy the children's work and their mini presentation at the end of class.
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- What to Bring -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                What to Bring
              </h2>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Comfortable clothes and closed-toe shoes for outdoor exploration</li>
                <li>Weather-appropriate layers and sun protection</li>
                <li>Water bottle</li>
                <li>Your car for transportation between locations</li>
                <li>Curiosity and creativity!</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                Please dress children appropriately for outdoor exploration and plan for a smooth transition between locations.
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">
                If you have any questions, simply reply to this email and we'll get back to you promptly.
              </p>
              <p style="color: #374151; font-size: 14px; margin: 16px 0 0; font-weight: 600;">
                Looking forward to a meaningful afternoon of nature and creativity together!
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 8px 0 0;">
                &mdash; The KindleWood &times; SteamOji Team
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Route Handler ───────────────────────────────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  const { mode, sessionType } = await req.json();

  if (mode === 'test') {
    const results = [];

    // Send morning sample
    const { error: errMorning } = await resend.emails.send({
      from: EMAIL_FROM,
      to: 'feifei_qiu@hotmail.com',
      subject: 'This Sunday: Little Crafter & Storyteller — Check-in Details',
      html: buildMorningReminderHtml('Test Parent', 'Test Child'),
      replyTo: REPLY_TO,
    });
    results.push({ type: 'morning', to: 'feifei_qiu@hotmail.com', error: errMorning?.message || null });

    // Send afternoon sample
    const { error: errAfternoon } = await resend.emails.send({
      from: EMAIL_FROM,
      to: 'feifei_qiu@hotmail.com',
      subject: 'This Sunday: Nature Explorer + Creativity Lab — Check-in & Logistics',
      html: buildAfternoonReminderHtml('Test Parent', 'Test Child'),
      replyTo: REPLY_TO,
    });
    results.push({ type: 'afternoon', to: 'feifei_qiu@hotmail.com', error: errAfternoon?.message || null });

    return NextResponse.json({ success: true, mode: 'test', results });
  }

  if (mode === 'send') {
    // sessionType filter: 'morning', 'afternoon', or undefined (both)
    const query = supabase
      .from('workshop_registrations')
      .select('parent_first_name, parent_email, child_first_name, selected_session_type')
      .eq('status', 'confirmed')
      .contains('selected_workshop_ids', ['steamoji-wk1']);

    if (sessionType === 'morning' || sessionType === 'afternoon') {
      query.eq('selected_session_type', sessionType);
    }

    const { data: registrations, error } = await query;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true, message: 'No confirmed registrations found', sent: 0 });
    }

    const results = [];

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      // Rate limit: wait 600ms between sends (Resend allows 2/sec)
      if (i > 0) await delay(600);

      const isMorning = reg.selected_session_type === 'morning';
      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: reg.parent_email,
        subject: isMorning
          ? 'This Sunday: Little Crafter & Storyteller — Check-in Details'
          : 'This Sunday: Nature Explorer + Creativity Lab — Check-in & Logistics',
        html: isMorning
          ? buildMorningReminderHtml(reg.parent_first_name, reg.child_first_name)
          : buildAfternoonReminderHtml(reg.parent_first_name, reg.child_first_name),
        replyTo: REPLY_TO,
      });
      results.push({
        type: reg.selected_session_type,
        to: reg.parent_email,
        child: reg.child_first_name,
        error: sendErr?.message || null,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'send',
      total: results.length,
      sent: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid mode. Use "test" or "send".' }, { status: 400 });
}
