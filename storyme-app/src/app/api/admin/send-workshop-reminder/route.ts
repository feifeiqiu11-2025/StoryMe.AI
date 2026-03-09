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

// ─── Weather Update Email (Afternoon Only) ──────────────────────────────

function buildWeatherUpdateHtml(parentFirstName: string, childFirstName: string): string {
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
                Sunday Weather Update
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                Nature Explorer + Creativity Lab
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
                We&rsquo;re excited to see <strong>${childFirstName}</strong> this Sunday for our Nature Explorer + Creativity Lab workshop!
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                We&rsquo;re keeping a close eye on tomorrow&rsquo;s weather forecast. In case of heavy rain, we may need to skip the outdoor nature walk (1:00 &ndash; 1:45 PM) and hold the entire session indoors at SteamOji Academy.
              </p>
            </td>
          </tr>

          <!-- Plan Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Here&rsquo;s the Plan
              </h2>

              <!-- Good Weather -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; overflow: hidden; margin-bottom: 12px;">
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #166534; font-size: 15px;">&#9728;&#65039; If weather is good</strong>
                    <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">
                      We proceed as planned with the outdoor nature walk at Bridle Trails State Park (arrive by 12:50 PM), followed by the indoor session at SteamOji (2:00 &ndash; 3:00 PM).
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Heavy Rain -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px;">
                    <strong style="color: #1e40af; font-size: 15px;">&#127783;&#65039; If heavy rain</strong>
                    <p style="color: #6b7280; font-size: 14px; margin: 8px 0 0; line-height: 1.6;">
                      We&rsquo;ll move everything indoors at SteamOji Academy. Please drop off at <strong style="color: #374151;">1:00 PM</strong> directly at SteamOji.<br />
                      <strong style="color: #374151;">Steamoji Academy &ndash; Bellevue</strong><br />
                      14315 NE 20th St, Suite C&ndash;E, Bellevue, WA 98007<br />
                      <span style="color: #9ca3af; font-size: 13px; font-style: italic;">(Steamoji is at the very right side of the plaza, next to StretchLab)</span><br />
                      The session will run <strong style="color: #374151;">1:00 &ndash; 2:00 PM</strong>.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Final Notice -->
          <tr>
            <td style="padding: 16px 24px;">
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 14px 16px;">
                <p style="color: #92400e; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>&#128232; We will send a final notice tomorrow morning</strong>, so please keep an eye on your email or text messages for the confirmed plan.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #374151; font-size: 14px; margin: 0; font-weight: 600;">
                Looking forward to a fun and creative afternoon either way!
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">
                If you have any questions, simply reply to this email.
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

// ─── Indoor-Only Final Notice (Afternoon) ───────────────────────────────

function buildIndoorNoticeHtml(parentFirstName: string, childFirstName: string): string {
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
                Today&rsquo;s Workshop: Indoor Only
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                Nature Explorer + Creativity Lab
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
                Due to today&rsquo;s rain, we&rsquo;ll be holding <strong>${childFirstName}</strong>&rsquo;s workshop entirely indoors at SteamOji Academy. No outdoor nature walk today.
              </p>
            </td>
          </tr>

          <!-- Updated Details -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Updated Details
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Time</strong><br />
                    <span style="color: #6b7280;">1:00 &ndash; 2:00 PM (drop off at 1:00 PM)</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px;">
                    <strong style="color: #374151;">Location</strong><br />
                    <span style="color: #6b7280;">Steamoji Academy &ndash; Bellevue</span><br />
                    <span style="color: #6b7280;">14315 NE 20th St, Suite C&ndash;E, Bellevue, WA 98007</span><br />
                    <span style="color: #9ca3af; font-size: 13px; font-style: italic;">(Steamoji is at the very right side of the plaza, next to StretchLab)</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Refund Notice -->
          <tr>
            <td style="padding: 16px 24px;">
              <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px;">
                <p style="color: #166534; font-size: 14px; margin: 0; line-height: 1.6;">
                  <strong>&#128176; $30 Credit</strong><br />
                  Since the outdoor portion is canceled, we will refund <strong>$30</strong> as credit toward a future workshop. No action needed on your end &mdash; we&rsquo;ll apply it automatically.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #374151; font-size: 14px; margin: 0; font-weight: 600;">
                We&rsquo;re still going to have a great time creating stories indoors!
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">
                If you have any questions, simply reply to this email.
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

// ─── Thank You + Promo Email ─────────────────────────────────────────────

const LOGO_URL = 'https://www.kindlewoodstudio.ai/Logo_New.png';

function buildThankYouHtml(parentFirstName: string, childFirstName: string): string {
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
                Your Workshop Comes With a Gift!
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                1 Month Free &mdash; KindleWood Studio Casual Creator Plan
              </p>
            </td>
          </tr>

          <!-- Greeting + Story Link -->
          <tr>
            <td style="padding: 32px 24px 16px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                Hi ${parentFirstName},
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                Thank you for bringing <strong>${childFirstName}</strong> to our Creative Explorers Workshop today! We had such a wonderful time creating together.
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                <strong>${childFirstName}</strong>&rsquo;s digital storybook is ready &mdash; you can view it anytime at <a href="https://www.kindlewoodstudio.ai/stories" style="color: #7c3aed; text-decoration: underline; font-weight: 600;">kindlewoodstudio.ai/stories</a>. For an even better reading and learning experience, download the <strong>KindleWood Kids</strong> iOS app &mdash; where your child can read along, learn new vocabulary, based on their own story.
              </p>
              <p style="margin: 12px 0 0;">
                <a href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039" style="color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: underline;">
                  Download KindleWood Kids on the App Store &rarr;
                </a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 24px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Promo Section -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#127873; Claim Your Free Month
              </h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 16px; line-height: 1.6;">
                As a workshop participant, your family gets <strong style="color: #374151;">1 month of free access</strong> to KindleWood Studio&rsquo;s online tools &mdash; so the creativity doesn&rsquo;t stop when class ends.
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">1.</strong> <span style="color: #6b7280;">Go to <a href="https://www.kindlewoodstudio.ai/signup" style="color: #7c3aed; text-decoration: underline;">kindlewoodstudio.ai/signup</a></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">2.</strong> <span style="color: #6b7280;">Create your free account</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">3.</strong> <span style="color: #6b7280;">Enter promo code: </span><strong style="color: #7c3aed; font-size: 16px; letter-spacing: 1px;">EXTENDEDTRIAL30</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px;">
                    <strong style="color: #374151;">4.</strong> <span style="color: #6b7280;">Start creating!</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 24px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Studio Features -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#9997;&#65039; What You Can Do with KindleWood Studio
              </h2>
              <p style="color: #9ca3af; font-size: 13px; margin: 0 0 8px; font-style: italic;">For parents &amp; teachers</p>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li><strong style="color: #374151;">Turn ideas into storybooks</strong> &mdash; From your child&rsquo;s voice, drawings, or text</li>
                <li><strong style="color: #374151;">Your child becomes the hero</strong> &mdash; Upload a photo, and they appear in every scene with consistent characters</li>
                <li><strong style="color: #374151;">Bilingual stories</strong> &mdash; English &amp; Chinese with professional illustrations</li>
                <li><strong style="color: #374151;">Voice narration</strong> &mdash; Record your own voice or use AI narration</li>
                <li><strong style="color: #374151;">Print-ready PDFs</strong> &mdash; Download and print keepsake storybooks</li>
                <li><strong style="color: #374151;">Publish to Spotify</strong> &mdash; Share stories as audio podcasts</li>
              </ul>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 24px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- Kids App -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 4px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#128241; KindleWood Kids App
              </h2>
              <div style="display: inline-block; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 2px 8px; margin: 4px 0 8px;">
                <span style="color: #166534; font-size: 12px; font-weight: 600;">For children &mdash; always free!</span>
              </div>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 12px; padding-left: 20px;">
                <li>Read &amp; listen to their personalized story library &mdash; ad-free, 100% safe</li>
                <li>Tap-to-learn vocabulary &mdash; hear pronunciation in English or Chinese</li>
                <li>Fun quizzes that adapt to their reading level</li>
                <li>Goal setting &amp; progress tracking &mdash; earn badges, celebrate milestones</li>
              </ul>
              <p style="margin: 0;">
                <a href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039" style="color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: underline;">
                  Download free on the App Store &rarr;
                </a>
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 8px 24px;">
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 0;" />
            </td>
          </tr>

          <!-- YouTube -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#127916; Watch How It Works
              </h2>
              <p style="margin: 0 0 8px;">
                <a href="https://www.youtube.com/playlist?list=PLyDpAVbXE4SWPWFFiQUdo8FyMAhi90fA5" style="color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: underline;">
                  Watch Product Demo Playlist &rarr;
                </a>
              </p>
              <ul style="color: #6b7280; font-size: 13px; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Parts 1&ndash;3: KindleWood Studio walkthrough (creating stories, characters, illustrations)</li>
                <li>Part 4: KindleWood Kids app demo (reading, quizzes, vocabulary)</li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #374151; font-size: 15px; margin: 0; font-weight: 600;">
                We can&rsquo;t wait to see what ${childFirstName} creates next!
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">
                Happy storytelling!
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 8px 0 0;">
                &mdash; The KindleWood Studio Team
              </p>
              <p style="margin: 20px 0 0;">
                <a href="https://www.kindlewoodstudio.ai" style="text-decoration: none;">
                  <img src="${LOGO_URL}" alt="KindleWood Studio" width="80" style="display: inline-block; max-width: 80px; height: auto;" />
                </a>
              </p>
              <p style="margin: 12px 0 0;">
                <a href="https://www.youtube.com/@KindleWoodStudio" style="color: #9ca3af; font-size: 13px; text-decoration: underline;">
                  YouTube
                </a>
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

  if (mode === 'weather-update') {
    // Send weather update to afternoon Wk1 parents
    const { data: registrations, error } = await supabase
      .from('workshop_registrations')
      .select('parent_first_name, parent_email, child_first_name')
      .eq('status', 'confirmed')
      .eq('selected_session_type', 'afternoon')
      .contains('selected_workshop_ids', ['steamoji-wk1']);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true, message: 'No afternoon Wk1 registrations found', sent: 0 });
    }

    const results = [];

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      if (i > 0) await delay(600);

      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: reg.parent_email,
        subject: 'Sunday Weather Update — Nature Explorer + Creativity Lab',
        html: buildWeatherUpdateHtml(reg.parent_first_name, reg.child_first_name),
        replyTo: REPLY_TO,
      });
      results.push({
        to: reg.parent_email,
        child: reg.child_first_name,
        error: sendErr?.message || null,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'weather-update',
      total: results.length,
      sent: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  }

  if (mode === 'indoor-notice') {
    const { data: registrations, error } = await supabase
      .from('workshop_registrations')
      .select('parent_first_name, parent_email, child_first_name')
      .eq('status', 'confirmed')
      .eq('selected_session_type', 'afternoon')
      .contains('selected_workshop_ids', ['steamoji-wk1']);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true, message: 'No afternoon Wk1 registrations found', sent: 0 });
    }

    const results = [];

    for (let i = 0; i < registrations.length; i++) {
      const reg = registrations[i];
      if (i > 0) await delay(600);

      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: reg.parent_email,
        subject: "Today's Workshop: Indoor Only — 1:00-2:00 PM at SteamOji",
        html: buildIndoorNoticeHtml(reg.parent_first_name, reg.child_first_name),
        replyTo: REPLY_TO,
      });
      results.push({
        to: reg.parent_email,
        child: reg.child_first_name,
        error: sendErr?.message || null,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'indoor-notice',
      total: results.length,
      sent: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  }

  if (mode === 'thank-you-test') {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: 'feifei_qiu@hotmail.com',
      subject: 'Your Workshop Comes With a Gift — 1 Month Free!',
      html: buildThankYouHtml('Feifei', 'Connor'),
      replyTo: REPLY_TO,
    });
    return NextResponse.json({ success: !error, error: error?.message || null, mode: 'thank-you-test' });
  }

  if (mode === 'thank-you') {
    const { data: registrations, error } = await supabase
      .from('workshop_registrations')
      .select('parent_first_name, parent_email, child_first_name, selected_session_type')
      .eq('status', 'confirmed')
      .contains('selected_workshop_ids', ['steamoji-wk1']);

    if (sessionType === 'morning' || sessionType === 'afternoon') {
      // Already filtered above, need to re-query with filter
    }

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true, message: 'No Wk1 registrations found', sent: 0 });
    }

    const filtered = sessionType
      ? registrations.filter(r => r.selected_session_type === sessionType)
      : registrations;

    const results = [];

    for (let i = 0; i < filtered.length; i++) {
      const reg = filtered[i];
      if (i > 0) await delay(600);

      const { error: sendErr } = await resend.emails.send({
        from: EMAIL_FROM,
        to: reg.parent_email,
        subject: 'Your Workshop Comes With a Gift — 1 Month Free!',
        html: buildThankYouHtml(reg.parent_first_name, reg.child_first_name),
        replyTo: REPLY_TO,
      });
      results.push({
        to: reg.parent_email,
        child: reg.child_first_name,
        session: reg.selected_session_type,
        error: sendErr?.message || null,
      });
    }

    return NextResponse.json({
      success: true,
      mode: 'thank-you',
      total: results.length,
      sent: results.filter(r => !r.error).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  }

  return NextResponse.json({ success: false, error: 'Invalid mode.' }, { status: 400 });
}
