/**
 * Workshop Registration Confirmation Email
 *
 * Sends a confirmation email to parents after successful payment.
 * Called from the Stripe webhook handler.
 */

import { resend, EMAIL_FROM } from './resend';
import { WORKSHOP_PARTNERS } from '@/lib/workshops/constants';

interface WorkshopConfirmationData {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  childFirstName: string;
  childLastName?: string | null;
  childAge: number;
  partnerId: string;
  selectedSessionType: 'morning' | 'afternoon';
  selectedWorkshopIds: string[];
  amountPaid: number; // cents
}

export async function sendWorkshopConfirmationEmail(
  data: WorkshopConfirmationData,
) {
  const partner = WORKSHOP_PARTNERS.find((p) => p.id === data.partnerId);
  if (!partner) {
    console.error(
      '[EMAIL] Partner not found for confirmation email:',
      data.partnerId,
    );
    return;
  }

  const sessionLabel =
    data.selectedSessionType === 'morning'
      ? 'Morning Session (Ages 4-6) · 10:00 - 11:00 AM'
      : 'Afternoon Session (Ages 7-9) · 1:00 - 3:00 PM';

  const selectedSessions = data.selectedWorkshopIds
    .map((id) => partner.sessions.find((s) => s.id === id))
    .filter(Boolean);

  const childFullName = data.childLastName
    ? `${data.childFirstName} ${data.childLastName}`
    : data.childFirstName;

  const amountFormatted = `$${(data.amountPaid / 100).toFixed(2)}`;

  const locationHtml = partner.location
    ? `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #374151;">Location</strong><br />
          <span style="color: #6b7280;">${partner.location.name}</span><br />
          <a href="${partner.location.mapUrl || '#'}" style="color: #2563eb; text-decoration: underline;">${partner.location.address}</a>
        </td>
      </tr>`
    : '';

  const sessionsHtml = selectedSessions
    .map((session, i) => {
      if (!session) return '';
      const slot = session[data.selectedSessionType];
      return `
      <tr>
        <td style="padding: 12px 16px; ${i < selectedSessions.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
          <strong style="color: #374151;">Week ${data.selectedWorkshopIds.indexOf(session.id) + 1}: ${session.theme}</strong><br />
          <span style="color: #6b7280;">${session.dateLabel} · ${slot.time}</span><br />
          <span style="color: #6b7280; font-size: 13px;">${slot.title}</span>
        </td>
      </tr>`;
    })
    .join('');

  const whatToBringItems =
    data.selectedSessionType === 'afternoon'
      ? `
      <li>Comfortable clothes and closed-toe shoes for outdoor exploration</li>
      <li>Weather-appropriate layers and sun protection</li>
      <li>Water bottle</li>
      <li>Your car for transportation between indoor studio and outdoor locations</li>
      <li>Curiosity and creativity!</li>`
      : `
      <li>Comfortable clothes (may get messy from art projects)</li>
      <li>Water bottle</li>
      <li>Curiosity and creativity!</li>`;

  const htmlContent = `
<!DOCTYPE html>
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
            <td style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">
                Registration Confirmed!
              </h1>
              <p style="color: #e0e7ff; margin: 8px 0 0; font-size: 15px;">
                ${partner.name} Workshop
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px 24px 16px;">
              <p style="color: #374151; font-size: 16px; margin: 0;">
                Hi ${data.parentFirstName},
              </p>
              <p style="color: #6b7280; font-size: 15px; margin: 12px 0 0; line-height: 1.6;">
                Thank you for registering <strong>${childFullName}</strong> (age ${data.childAge}) for our Creative Explorers Workshop! We're excited to welcome your family.
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
                    <strong style="color: #374151;">Session Type</strong><br />
                    <span style="color: #6b7280;">${sessionLabel}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
                    <strong style="color: #374151;">Child</strong><br />
                    <span style="color: #6b7280;">${childFullName}, age ${data.childAge}</span>
                  </td>
                </tr>
                ${locationHtml}
                <tr>
                  <td style="padding: 12px 16px;">
                    <strong style="color: #374151;">Amount Paid</strong><br />
                    <span style="color: #6b7280;">${amountFormatted}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Selected Workshops -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                Your Workshop Schedule
              </h2>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; overflow: hidden;">
                ${sessionsHtml}
              </table>
            </td>
          </tr>

          <!-- What to Bring -->
          <tr>
            <td style="padding: 16px 24px;">
              <h2 style="color: #374151; font-size: 18px; margin: 0 0 12px; border-bottom: 2px solid #7c3aed; padding-bottom: 8px;">
                What to Bring
              </h2>
              <ul style="color: #6b7280; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0;">
                ${whatToBringItems}
              </ul>
            </td>
          </tr>

          ${
            data.selectedSessionType === 'afternoon'
              ? `
          <!-- Afternoon Note -->
          <tr>
            <td style="padding: 0 24px 16px;">
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px;">
                <p style="color: #92400e; font-size: 13px; margin: 0; line-height: 1.5;">
                  <strong>Note for Afternoon Sessions:</strong> The afternoon session includes outdoor exploration at nearby parks. Parents are responsible for transporting their child between the indoor studio and outdoor locations by car. Please arrive 5 minutes early for the outdoor portion.
                </p>
              </div>
            </td>
          </tr>`
              : ''
          }

          <!-- Footer -->
          <tr>
            <td style="padding: 24px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; line-height: 1.6; text-align: center;">
                Questions? Reply to this email or contact us at
                <a href="mailto:Admin@KindleWoodStudio.ai" style="color: #7c3aed;">Admin@KindleWoodStudio.ai</a>
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 12px 0 0; text-align: center;">
                &copy; ${new Date().getFullYear()} KindleWood Studio. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const textContent = `Registration Confirmed - ${partner.name} Workshop

Hi ${data.parentFirstName},

Thank you for registering ${childFullName} (age ${data.childAge}) for our Creative Explorers Workshop!

SESSION DETAILS
- Session: ${sessionLabel}
- Child: ${childFullName}, age ${data.childAge}
${partner.location ? `- Location: ${partner.location.name}, ${partner.location.address}` : ''}
- Amount Paid: ${amountFormatted}

YOUR WORKSHOP SCHEDULE
${selectedSessions
  .map((session) => {
    if (!session) return '';
    const slot = session[data.selectedSessionType];
    return `- ${session.theme}: ${session.dateLabel} · ${slot.time} — ${slot.title}`;
  })
  .join('\n')}

WHAT TO BRING
${
  data.selectedSessionType === 'afternoon'
    ? `- Comfortable clothes and closed-toe shoes for outdoor exploration
- Weather-appropriate layers and sun protection
- Water bottle
- Your car for transportation between indoor studio and outdoor locations
- Curiosity and creativity!`
    : `- Comfortable clothes (may get messy from art projects)
- Water bottle
- Curiosity and creativity!`
}
${
  data.selectedSessionType === 'afternoon'
    ? `
NOTE: The afternoon session includes outdoor exploration at nearby parks. Parents are responsible for transporting their child between the indoor studio and outdoor locations by car.`
    : ''
}

Questions? Contact us at Admin@KindleWoodStudio.ai

KindleWood Studio`;

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: data.parentEmail,
      subject: `Registration Confirmed — ${partner.name} Workshop`,
      html: htmlContent,
      text: textContent,
      replyTo: 'Admin@KindleWoodStudio.ai',
    });

    if (error) {
      console.error('[EMAIL] Failed to send confirmation:', error);
      return;
    }

    console.log(
      `[EMAIL] Workshop confirmation sent to ${data.parentEmail}`,
    );
  } catch (error) {
    // Email failure should not block the webhook response
    console.error('[EMAIL] Error sending confirmation:', error);
  }
}
