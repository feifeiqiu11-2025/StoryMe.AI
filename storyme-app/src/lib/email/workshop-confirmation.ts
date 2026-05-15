/**
 * Workshop Registration Confirmation Email
 *
 * Sends a confirmation email to parents after successful payment.
 * Called from the Stripe webhook handler.
 */

import { resend, EMAIL_FROM } from './resend';
import { WORKSHOP_PARTNERS } from '@/lib/workshops/constants';

interface ChildInfo {
  firstName: string;
  lastName?: string | null;
  age: number;
}

interface WorkshopConfirmationData {
  parentFirstName: string;
  parentLastName: string;
  parentEmail: string;
  children: ChildInfo[];
  partnerId: string;
  selectedSessionType: 'morning' | 'afternoon' | 'single';
  selectedWorkshopIds: string[];
  amountPaid: number; // cents
  location?: string | null; // location slug for multi-location partners
  timeSlot?: string | null; // chosen time slot slug (e.g. 'slot-1') if applicable
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

  const isSingleMode = partner.sessionMode === 'single';
  const isAfternoon = data.selectedSessionType === 'afternoon';
  const isMorning = data.selectedSessionType === 'morning';

  // Resolve location and chosen time slot
  const locationInfo = data.location && partner.locations
    ? partner.locations.find((l) => l.slug === data.location)
    : null;
  const singularLocation = !locationInfo ? partner.location : null;
  const chosenSlot = data.timeSlot
    ? (locationInfo?.timeSlots || partner.location?.timeSlots)?.find(
        (ts) => ts.slug === data.timeSlot,
      )
    : null;

  // Build the session-type label using the partner's program config rather than
  // hardcoded ages/times. Falls back to legacy strings for older partners.
  const programForType =
    (isMorning && partner.morningProgram) ||
    (isAfternoon && partner.afternoonProgram) ||
    null;
  const programAgeLabel =
    programForType?.ageLabel ||
    (isMorning ? 'Ages 4–6' : isAfternoon ? 'Ages 7–12' : 'Ages 3–6');
  const programTimeLabel =
    chosenSlot?.label ||
    programForType?.timeLabel ||
    (isMorning ? '10:00 – 11:00 AM' : isAfternoon ? '1:00 – 3:00 PM' : '');
  const programName =
    programForType?.name || (isMorning ? 'Morning Session' : isAfternoon ? 'Afternoon Session' : '');

  const sessionLabel = isSingleMode
    ? `${partner.sessions[0]?.morning.ageRange || 'Ages 3–6'}`
    : `${programName} (${programAgeLabel}) · ${programTimeLabel}`;

  const selectedSessions = data.selectedWorkshopIds
    .map((id) => partner.sessions.find((s) => s.id === id))
    .filter(Boolean);

  // Format children names
  const formatChildName = (c: ChildInfo) =>
    c.lastName ? `${c.firstName} ${c.lastName}` : c.firstName;

  const childrenWithAge = data.children
    .map((c) => `<strong>${formatChildName(c)}</strong> (age ${c.age})`)
    .join(' and ');

  const childrenListText = data.children
    .map((c) => `${formatChildName(c)}, age ${c.age}`)
    .join('; ');

  const amountFormatted = `$${(data.amountPaid / 100).toFixed(2)}`;

  const locationHtml = locationInfo
    ? `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #e5e7eb;">
          <strong style="color: #374151;">Location</strong><br />
          <span style="color: #6b7280;">${locationInfo.name}</span>
          ${locationInfo.address && locationInfo.address !== 'TBD' ? `<br /><span style="color: #6b7280;">${locationInfo.address}</span>` : ''}
        </td>
      </tr>`
    : partner.location
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
      const slot = isSingleMode
        ? session.morning
        : (isAfternoon && session.afternoon
            ? session.afternoon
            : session.morning);
      // Morning shows the topic name (e.g. "Time Master") in the bold header.
      // Afternoon shows the chapter/session title since the "theme" field on
      // the data is morning-centric (topicLabel). Single mode keeps theme.
      const boldTitle = isAfternoon
        ? slot.title
        : session.theme;
      // For the body line, prefer the user's chosen slot label over the
      // generic time string (which can list multiple slot options).
      const displayTime = isMorning && chosenSlot?.label
        ? chosenSlot.label
        : slot.time;
      // Avoid repeating the same title on the body line when bold already shows it.
      const bodyDetail = boldTitle === slot.title ? '' : slot.title;
      return `
      <tr>
        <td style="padding: 12px 16px; ${i < selectedSessions.length - 1 ? 'border-bottom: 1px solid #e5e7eb;' : ''}">
          <strong style="color: #374151;">${session.dateLabel}: ${boldTitle}</strong><br />
          <span style="color: #6b7280;">${displayTime && displayTime !== 'TBD' ? displayTime : ''}${displayTime && displayTime !== 'TBD' && bodyDetail ? ' · ' : ''}${bodyDetail}</span>
        </td>
      </tr>`;
    })
    .join('');

  const whatToBringItems = isSingleMode
    ? `
      <li>Comfortable clothes (may get messy from art projects)</li>
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
            <td style="background-color: #6d28d9; background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 32px; text-align: center;">
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
                Thank you for registering ${childrenWithAge} for the ${programName || 'workshop'}! We're excited to welcome your family.
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
                    <strong style="color: #374151;">${data.children.length > 1 ? 'Children' : 'Child'}</strong><br />
                    <span style="color: #6b7280;">${childrenListText}</span>
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

  const textContent = `Registration Confirmed - ${partner.name}

Hi ${data.parentFirstName},

Thank you for registering ${data.children.map((c) => `${formatChildName(c)} (age ${c.age})`).join(' and ')} for the ${programName || 'workshop'}!

SESSION DETAILS
- Session: ${sessionLabel}
- ${data.children.length > 1 ? 'Children' : 'Child'}: ${childrenListText}
${locationInfo ? `- Location: ${locationInfo.name}` : singularLocation ? `- Location: ${singularLocation.name}, ${singularLocation.address}` : ''}
- Amount Paid: ${amountFormatted}

YOUR WORKSHOP SCHEDULE
${selectedSessions
  .map((session) => {
    if (!session) return '';
    const slot = isSingleMode
      ? session.morning
      : (isAfternoon && session.afternoon ? session.afternoon : session.morning);
    const boldTitle = isAfternoon ? slot.title : session.theme;
    const displayTime = isMorning && chosenSlot?.label ? chosenSlot.label : slot.time;
    const bodyDetail = boldTitle === slot.title ? '' : slot.title;
    const timePart = displayTime && displayTime !== 'TBD' ? ` · ${displayTime}` : '';
    const detailPart = bodyDetail ? ` — ${bodyDetail}` : '';
    return `- ${session.dateLabel}: ${boldTitle}${timePart}${detailPart}`;
  })
  .join('\n')}

WHAT TO BRING
- Comfortable clothes (may get messy from art projects)
- Water bottle
- Curiosity and creativity!

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
