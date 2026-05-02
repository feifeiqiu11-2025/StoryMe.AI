/**
 * School Bundle Checkout Email
 *
 * Sent by admin via /admin/school-bundles "Email link" action. Delivers the
 * Stripe Checkout URL to the school's primary teacher with friendly framing.
 *
 * Style mirrors workshop-confirmation.ts: 600px card, purple gradient header,
 * light footer.
 */

import { resend, EMAIL_FROM } from './resend';

interface SchoolBundleCheckoutEmailData {
  primaryFirstName: string | null; // null → use "there" greeting
  primaryEmail: string;
  schoolName: string;
  checkoutUrl: string;
  priceFormatted: string; // e.g. "$129.99"
}

const ADMIN_BCC = 'admin@kindlewoodstudio.ai';

function buildHtml(data: SchoolBundleCheckoutEmailData): string {
  const greeting = data.primaryFirstName ? `Hi ${data.primaryFirstName},` : 'Hi there,';

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
                Welcome to KindleWood Studio
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                Let's set up ${escapeHtml(data.schoolName)}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 24px 8px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                ${escapeHtml(greeting)}
              </p>
              <p style="color: #4b5563; font-size: 15px; margin: 16px 0 0; line-height: 1.6;">
                Welcome to KindleWood Studio. Your school bundle subscription for
                <strong>${escapeHtml(data.schoolName)}</strong> is ready to activate.
              </p>
              <p style="color: #4b5563; font-size: 15px; margin: 16px 0 0; line-height: 1.6;">
                Your bundle includes 4 teacher accounts with full access &mdash;
                <a href="https://kindlewoodstudio.ai" style="color: #7c3aed; text-decoration: none;">kindlewoodstudio.ai</a>
                has the full tour of features.
              </p>
              <p style="color: #4b5563; font-size: 15px; margin: 24px 0 0; line-height: 1.6;">
                <strong style="color: #374151;">One step left:</strong> add your billing details to activate.
              </p>
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td style="padding: 24px 24px 16px; text-align: center;">
              <a href="${escapeHtml(data.checkoutUrl)}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600; text-decoration: none;">
                Activate School Bundle &rarr;
              </a>
            </td>
          </tr>

          <!-- Plain-text fallback URL -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.5; word-break: break-all;">
                Button not working? Open this link:<br />
                <a href="${escapeHtml(data.checkoutUrl)}" style="color: #7c3aed; text-decoration: none;">${escapeHtml(data.checkoutUrl)}</a>
              </p>
            </td>
          </tr>

          <!-- Pricing + expiry details -->
          <tr>
            <td style="padding: 0 24px 24px;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                ${escapeHtml(data.priceFormatted)}/month, billed monthly. Cancel anytime via your billing portal.
              </p>
              <p style="color: #6b7280; font-size: 14px; margin: 12px 0 0; line-height: 1.6;">
                The link expires in 24 hours. If that happens, just reply and we&rsquo;ll send a fresh one.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; text-align: center;">
              <p style="color: #6b7280; font-size: 14px; margin: 0; line-height: 1.6;">
                Questions? Reply to this email and we&rsquo;ll help.
              </p>
              <p style="color: #9ca3af; font-size: 13px; margin: 16px 0 0;">
                &mdash; The KindleWood Studio team
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendSchoolBundleCheckoutEmail(data: SchoolBundleCheckoutEmailData) {
  const subject = `Welcome to KindleWood Studio — let's set up ${data.schoolName}`;

  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: data.primaryEmail,
    bcc: ADMIN_BCC,
    replyTo: 'admin@kindlewoodstudio.ai',
    subject,
    html: buildHtml(data),
  });

  if (result.error) {
    throw new Error(`Resend failed: ${result.error.message}`);
  }

  return result.data;
}
