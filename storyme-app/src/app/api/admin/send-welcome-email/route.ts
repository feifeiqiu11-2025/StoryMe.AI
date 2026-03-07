/**
 * Admin API: Send Welcome Email (Test)
 *
 * POST /api/admin/send-welcome-email
 * Body: { mode: 'test', to?: string, firstName?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { resend, EMAIL_FROM } from '@/lib/email/resend';

const REPLY_TO = 'Admin@KindleWoodStudio.ai';
const LOGO_URL = 'https://www.kindlewoodstudio.ai/Logo_New.png';

function buildWelcomeHtml(firstName: string): string {
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

          <!-- Logo + Welcome Header -->
          <tr>
            <td style="padding: 32px 24px 16px; text-align: center;">
              <a href="https://www.kindlewoodstudio.ai" style="text-decoration: none;">
                <img src="${LOGO_URL}" alt="KindleWood Studio" width="160" style="display: inline-block; max-width: 160px; height: auto;" />
              </a>
              <h1 style="color: #374151; font-size: 22px; margin: 12px 0 0; font-weight: 700;">
                Welcome to KindleWood!
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 16px 24px 16px;">
              <p style="color: #6b7280; font-size: 15px; margin: 0; line-height: 1.7;">
                Hi ${firstName},
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.7;">
                Thank you for joining KindleWood! We&rsquo;re so glad you&rsquo;re here.
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.7;">
                KindleWood is where children&rsquo;s creativity becomes their learning adventure. Kids turn their own drawings and imagination into personalized storybooks &mdash; stories they actually want to read, because <em>they</em> made them. Through creating, reading, and exploring their own stories, children build literacy skills, expand vocabulary, and develop a lifelong love for learning &mdash; all while having fun.
              </p>
            </td>
          </tr>

          <!-- Studio Section -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#9997;&#65039; KindleWood Studio &mdash; Create
              </h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px; line-height: 1.6;">
                Your creative workspace where kids&rsquo; ideas come to life:
              </p>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 20px; padding-left: 20px;">
                <li><strong style="color: #374151;">From Drawing to Storybook</strong> &mdash; Turn your child&rsquo;s artwork and imagination into fully illustrated stories</li>
                <li><strong style="color: #374151;">Consistent Characters</strong> &mdash; Create custom characters that stay the same across every scene</li>
                <li><strong style="color: #374151;">Bilingual Stories</strong> &mdash; Generate side-by-side English and Chinese storybooks</li>
                <li><strong style="color: #374151;">Voice Narration</strong> &mdash; Add natural-sounding narration for read-along experiences</li>
                <li><strong style="color: #374151;">Printable Storybooks</strong> &mdash; Download beautiful PDFs to read offline or share</li>
                <li><strong style="color: #374151;">Publish as Podcast</strong> &mdash; Turn stories into audio episodes on Spotify</li>
                <li><strong style="color: #374151;">Great for Classrooms</strong> &mdash; Perfect for teachers, workshops, and creative learning projects</li>
              </ul>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" style="background-color: #7c3aed; border-radius: 8px;">
                    <a href="https://www.kindlewoodstudio.ai/create" style="display: inline-block; padding: 14px 32px; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; letter-spacing: 0.3px;">
                      Start Creating Your First Story &rarr;
                    </a>
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

          <!-- Kids App Section -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#128241; KindleWood Kids &mdash; Read, Learn &amp; Grow
              </h2>
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 12px; line-height: 1.6;">
                A safe reading app designed just for young learners:
              </p>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; margin: 0 0 16px; padding-left: 20px;">
                <li><strong style="color: #374151;">Personalized Reading</strong> &mdash; Kids read stories they helped create, making reading meaningful</li>
                <li><strong style="color: #374151;">Interactive Vocabulary</strong> &mdash; Tap any word to hear pronunciation and learn its meaning</li>
                <li><strong style="color: #374151;">Audio Narration</strong> &mdash; Listen along while following the text</li>
                <li><strong style="color: #374151;">Comprehension Quizzes</strong> &mdash; Fun quizzes that reinforce understanding</li>
                <li><strong style="color: #374151;">Reading Goals &amp; Progress</strong> &mdash; Track milestones and build strong reading habits</li>
                <li><strong style="color: #374151;">100% Safe &amp; Ad-Free</strong> &mdash; No ads, no in-app purchases, just learning</li>
              </ul>
              <p style="margin: 0;">
                <a href="https://apps.apple.com/us/app/kindlewood-kids/id6755075039" style="color: #2563eb; font-size: 14px; font-weight: 600; text-decoration: underline;">
                  Download on the App Store &rarr;
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

          <!-- YouTube Section -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                &#127916; See It in Action
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Product Demo</strong><br />
                    <span style="color: #6b7280; font-size: 14px;">Watch how KindleWood works from start to finish &mdash; story creation, illustration, narration, and more.</span><br />
                    <a href="https://www.youtube.com/playlist?list=PLyDpAVbXE4SWPWFFiQUdo8FyMAhi90fA5" style="color: #2563eb; font-size: 14px; text-decoration: underline;">
                      Watch Product Demo Playlist &rarr;
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 14px 16px;">
                    <strong style="color: #374151;">Community Workshops</strong><br />
                    <span style="color: #6b7280; font-size: 14px;">See highlights from our in-person creative workshops for kids.</span><br />
                    <a href="https://www.youtube.com/playlist?list=PLyDpAVbXE4SWavZNKd0RNlhDuEJqpBkY0" style="color: #2563eb; font-size: 14px; text-decoration: underline;">
                      Watch Workshop Highlights &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                Need help? Just reply to this email &mdash; we&rsquo;d love to hear from you!
              </p>
              <p style="color: #374151; font-size: 14px; margin: 16px 0 0; font-weight: 600;">
                Happy storytelling!
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 8px 0 0;">
                &mdash; The KindleWood Studio Team
              </p>
              <p style="margin: 16px 0 0;">
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

export async function POST(req: NextRequest) {
  const { mode, to, firstName } = await req.json();

  if (mode === 'test') {
    const recipient = to || 'feifei_qiu@hotmail.com';
    const name = firstName || 'there';

    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipient,
      subject: 'Welcome to KindleWood — Where Kids Create, Read & Grow!',
      html: buildWelcomeHtml(name),
      replyTo: REPLY_TO,
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, mode: 'test', sentTo: recipient });
  }

  return NextResponse.json({ success: false, error: 'Invalid mode. Use "test".' }, { status: 400 });
}
