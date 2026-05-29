/**
 * Summer Creative Storyteller Workshop — follow-up email.
 *
 * Follow-up to summer-workshop-2026: targets the same workshop_only audience
 * (past workshop participants) to nudge them about remaining spots in the
 * afternoon Creative Writer track (ages 7–12) and pitch the May 31 half-price
 * intro session as a no-commitment way to try the program before signing up
 * for the full 4-session chapter book + podcast project.
 *
 * New campaign_id means the dedupe constraint on marketing_email_sends won't
 * block recipients who already received summer-workshop-2026 — that's the
 * intended behavior for a follow-up nudge.
 *
 * Style/theme intentionally mirrors summer-workshop-promo.ts so the family of
 * emails feels coherent (cream/brown KindleWood palette, Caveat + Quicksand).
 */

import { buildUnsubscribeUrl, getUnsubscribeHeaders } from './unsubscribe-token';

export const SUMMER_WORKSHOP_FOLLOWUP_CAMPAIGN_ID = 'summer-workshop-followup-2026';
export const SUMMER_WORKSHOP_FOLLOWUP_SUBJECT =
  'Try Creative Writer for half-price on May 31 — no commitment yet';
export const SUMMER_WORKSHOP_FOLLOWUP_PREHEADER =
  'A few afternoon spots left for kids 7–12. Come try the May 31 intro at half-price, then decide.';

const PROD_URL = 'https://www.kindlewoodstudio.ai';
const YT_URL = 'https://www.youtube.com/@KindleWoodStudio';

// System sans-serif stack — readable everywhere with no font download.
// Helvetica/Arial render cleanly in Gmail, Outlook, Apple Mail, and the
// browser preview without needing Google Fonts to load.
const CURSIVE = "'Caveat', 'Bradley Hand', 'Marker Felt', cursive";
const BODY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

export interface RenderedSummerWorkshopFollowup {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

/**
 * @param recipientEmail - signed into the unsubscribe URL
 * @param baseUrl - origin for image asset URLs. Defaults to production so
 *   live sends always reach the deployed assets. The browser-preview route
 *   passes the request origin (e.g. http://localhost:3000) so local previews
 *   render with the local public/images/ copies.
 */
export function renderSummerWorkshopFollowup(
  recipientEmail: string,
  baseUrl: string = PROD_URL,
): RenderedSummerWorkshopFollowup {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  const workshopsUrl = `${PROD_URL}/workshops#steamoji`;
  const flyerUrl = `${baseUrl}/images/CreativeWriterFlyer.jpg`;
  const introUrl = `${baseUrl}/images/CreativeWriterIntro.png`;
  return {
    subject: SUMMER_WORKSHOP_FOLLOWUP_SUBJECT,
    html: buildHtml(unsubscribeUrl, workshopsUrl, flyerUrl, introUrl),
    text: buildText(unsubscribeUrl, workshopsUrl),
    headers: getUnsubscribeHeaders(recipientEmail),
  };
}

function buildHtml(
  unsubscribeUrl: string,
  workshopsUrl: string,
  flyerUrl: string,
  introUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Try Creative Writer on May 31 — half-price intro</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#F5EBD6; font-family:${BODY}; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F5EBD6; font-size:1px; line-height:1px;">
    ${SUMMER_WORKSHOP_FOLLOWUP_PREHEADER}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5EBD6;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; background-color:#FFFFFF; border-radius:14px;">

          <!-- Warm intro -->
          <tr>
            <td style="font-family:${BODY}; color:#1a1208; font-size:17px; line-height:1.65; font-weight:500; padding:36px 32px 14px;">
              A quick follow-up for our <strong>KindleWood families</strong> &mdash; we still have a couple of spots open in the <strong>afternoon Creative Writer Workshop</strong> (ages 7&ndash;12), co-hosted by <strong style="color:#8B4513;">KindleWood &times; Steamoji</strong> at the Bellevue lab.
            </td>
          </tr>

          <!-- Highlight what makes the program special -->
          <tr>
            <td style="font-family:${BODY}; color:#1a1208; font-size:17px; line-height:1.65; font-weight:500; padding:0 32px 14px;">
              Over five Sundays, kids will <strong>write their own chapter book</strong> and <strong>record their own podcast</strong> &mdash; from story arc to character voices to the final audio episode. Small class, 4:1 ratio, hands-on the whole way.
            </td>
          </tr>

          <!-- Section transition -->
          <tr>
            <td align="center" style="font-family:${BODY}; font-weight:700; font-size:22px; color:#1a1208; padding:14px 24px 6px;">
              Not ready to commit?
            </td>
          </tr>
          <tr>
            <td align="center" style="font-family:${BODY}; font-weight:600; font-size:17px; color:#2a1d10; padding:0 24px 22px;">
              Come try May 31 for half-price.
            </td>
          </tr>

          <!-- No-commitment pitch -->
          <tr>
            <td style="font-family:${BODY}; color:#1a1208; font-size:17px; line-height:1.65; font-weight:500; padding:0 32px 24px;">
              Drop in on our <strong>Sunday, May 31 intro session</strong> at <strong>half-price</strong> &mdash; experience the flow, meet the team, and let your child try the creative activities first. After that, you can decide whether to sign up for the remaining 4 chapter-book + podcast sessions. No pressure, no commitment.
            </td>
          </tr>

          <!-- Hero: program flyer -->
          <tr>
            <td align="center" style="padding:0 16px 18px;">
              <img src="${flyerUrl}" width="608" alt="Creative Writer Workshop flyer — KindleWood × Steamoji. Ages 7–12. Kids write their own chapter book and record their own podcast over five Sundays. Steamoji Bellevue lab. Small 4:1 class size." style="display:block; width:100%; max-width:608px; height:auto; border-radius:10px; border:0;" />
            </td>
          </tr>

          <!-- Secondary: 1-page intro explainer -->
          <tr>
            <td align="center" style="padding:0 16px 24px;">
              <img src="${introUrl}" width="608" alt="Creative Writer Workshop one-page intro — what kids will create, the week-by-week flow, and what to expect from the half-price May 31 intro session." style="display:block; width:100%; max-width:608px; height:auto; border-radius:10px; border:0;" />
            </td>
          </tr>

          <!-- Summary line -->
          <tr>
            <td style="font-family:${BODY}; color:#2a1d10; font-size:15px; line-height:1.65; font-weight:500; padding:0 32px 6px;">
              <strong>Afternoons</strong> (Ages 7&ndash;12) &middot; Creative Writer Workshop
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; color:#2a1d10; font-size:15px; line-height:1.65; font-weight:500; padding:0 32px 22px;">
              May 31 &rarr; Jun 28 &middot; Steamoji Bellevue &middot; Half-price May 31 intro available
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:0 24px 36px;">
              <a href="${workshopsUrl}" style="display:inline-block; padding:14px 28px; background-color:#3F6B3A; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:15px; font-weight:600; letter-spacing:0.3px;">Reserve your May 31 spot &rarr;</a>
            </td>
          </tr>

          <!-- Spacer divider -->
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <div style="width:80px; height:1px; background-color:#D9C9A8; line-height:1px; font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:8px 24px 36px; border-top:1px solid #E5D8BD;">
              <div style="font-family:${CURSIVE}; font-weight:700; color:#2a1d10; font-size:22px; padding:24px 0 6px;">
                Happy storytelling!
              </div>
              <div style="font-family:${BODY}; color:#2a1d10; font-size:15px; padding-bottom:18px;">
                &mdash; The KindleWood Team
              </div>
              <div style="font-family:${BODY}; font-size:14px; color:#3a2e1f; padding-bottom:14px;">
                <a href="${PROD_URL}" style="color:#8B4513; text-decoration:underline;">kindlewoodstudio.ai</a>
                &nbsp;&middot;&nbsp;
                <a href="${YT_URL}" style="color:#8B4513; text-decoration:underline;">YouTube</a>
              </div>
              <div style="font-family:${BODY}; font-size:13px; color:#3a2e1f;">
                Questions? Simply reply to this email.
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeUrl}" style="color:#3a2e1f; text-decoration:underline;">Unsubscribe</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildText(unsubscribeUrl: string, workshopsUrl: string): string {
  return `A quick follow-up for our KindleWood families — we still have a couple of spots open in the afternoon Creative Writer Workshop (ages 7–12), co-hosted by KindleWood × Steamoji at the Bellevue lab.

Over five Sundays, kids will write their own chapter book and record their own podcast — from story arc to character voices to the final audio episode. Small class, 4:1 ratio, hands-on the whole way.

Not ready to commit? Come try May 31 for half-price.

Drop in on our Sunday, May 31 intro session at half-price — experience the flow, meet the team, and let your child try the creative activities first. After that, you can decide whether to sign up for the remaining 4 chapter-book + podcast sessions. No pressure, no commitment.

Afternoons (Ages 7–12) · Creative Writer Workshop
May 31 → Jun 28 · Steamoji Bellevue · Half-price May 31 intro available

Reserve your May 31 spot: ${workshopsUrl}

Happy storytelling!
— The KindleWood Team

${PROD_URL}  ·  ${YT_URL}

Questions? Simply reply to this email.
Unsubscribe: ${unsubscribeUrl}
`;
}
