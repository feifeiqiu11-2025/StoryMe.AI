/**
 * Summer Creative Storyteller Workshop promo email.
 *
 * Targeted at past workshop participants (deduped from workshop_registrations).
 * Cream/brown theme matches the Spark letter for brand consistency. The flyer
 * image is hosted (not inlined) so the HTML stays small and Gmail won't clip.
 *
 * Exports `renderSummerWorkshopPromo(email)` returning
 * { subject, html, text, headers } — matches the renderer signature used by
 * /api/admin/send-marketing-email so this campaign plugs into the existing
 * allowlist with no route changes beyond importing.
 */

import { buildUnsubscribeUrl, getUnsubscribeHeaders } from './unsubscribe-token';

export const SUMMER_WORKSHOP_PROMO_CAMPAIGN_ID = 'summer-workshop-2026';
export const SUMMER_WORKSHOP_PROMO_SUBJECT =
  'Summer workshops are back — Creative Storyteller Series, May 31';
export const SUMMER_WORKSHOP_PROMO_PREHEADER =
  'Five Sundays starting May 31. Limited 4:1 small-class spots at the Steamoji Bellevue lab.';

const SITE_URL = 'https://www.kindlewoodstudio.ai';
const YT_URL = 'https://www.youtube.com/@KindleWoodStudio';
const WORKSHOPS_URL = `${SITE_URL}/workshops#steamoji`;
const FLYER_URL = `${SITE_URL}/images/summer-2026-flyer-v2.jpg`;
const LOGO_URL = `${SITE_URL}/Logo_New.png`;

// Match the Spark letter type system exactly so the family of emails feels coherent.
const CURSIVE = "'Caveat', 'Bradley Hand', 'Marker Felt', cursive";
const BODY = "'Quicksand', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

export interface RenderedSummerWorkshopPromo {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

// Matches the (email: string) => Rendered renderer signature used by
// /api/admin/send-marketing-email so this campaign plugs into the same allowlist.
export function renderSummerWorkshopPromo(
  recipientEmail: string,
): RenderedSummerWorkshopPromo {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  return {
    subject: SUMMER_WORKSHOP_PROMO_SUBJECT,
    html: buildHtml(unsubscribeUrl),
    text: buildText(unsubscribeUrl),
    headers: getUnsubscribeHeaders(recipientEmail),
  };
}

function buildHtml(unsubscribeUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Summer workshops are back</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 480px) {
    .summary-row { display:block !important; width:100% !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5EBD6; font-family:${BODY};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F5EBD6; font-size:1px; line-height:1px;">
    ${SUMMER_WORKSHOP_PROMO_PREHEADER}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5EBD6;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="max-width:640px; background-color:#FBF6EC; border-radius:14px;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:28px 28px 18px;">
              <img src="${LOGO_URL}" alt="KindleWood Studio" width="160" style="display:block; width:160px; max-width:60%; height:auto; border:0;" />
            </td>
          </tr>

          <!-- Warm intro (no name greeting — matches Spark letter style) -->
          <tr>
            <td style="font-family:${BODY}; font-weight:500; color:#2a1d10; font-size:16px; line-height:1.7; padding:8px 32px 14px;">
              Thank you for being part of our <strong>KindleWood families</strong> &mdash; it means a lot to us.
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; font-weight:500; color:#2a1d10; font-size:16px; line-height:1.7; padding:0 32px 24px;">
              We're excited to share that our <strong>Creative Storyteller Summer Series</strong>, co-hosted by <strong style="color:#8B4513;">KindleWood &times; Steamoji</strong>, is back &mdash; <strong>five Sundays starting Sunday, May 31</strong> at the Steamoji Bellevue lab.
            </td>
          </tr>

          <!-- Handwritten transition line -->
          <tr>
            <td align="center" style="font-family:${CURSIVE}; font-weight:700; font-size:26px; color:#3a2e1f; padding:4px 24px 20px;">
              Here's the full lineup:
            </td>
          </tr>

          <!-- Flyer image (hosted, lazy-loaded by Gmail). Intentionally NOT
               wrapped in an anchor — readers may want to tap and zoom in to
               inspect the flyer without being yanked off to another page.
               The dedicated CTA button below handles the registration intent. -->
          <tr>
            <td align="center" style="padding:0 16px 24px;">
              <img src="${FLYER_URL}" width="608" alt="KindleWood × Steamoji Creative Storyteller Summer Series. Morning Program for ages 4–6 (Time Masters and Little Entrepreneurs) and Afternoon Program for ages 7–12 (Creative Writer Workshop, original chapter book project). Small class size 4:1. Five Sundays at Steamoji Bellevue starting May 31." style="display:block; width:100%; max-width:608px; height:auto; border-radius:10px; border:0;" />
            </td>
          </tr>

          <!-- Summary line with program breakdown -->
          <tr>
            <td style="font-family:${BODY}; font-weight:500; color:#2a1d10; font-size:15px; line-height:1.7; padding:0 32px 6px;">
              <strong>Mornings</strong> (Ages 4&ndash;6) &middot; 4 sessions across 2 topic pairs
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; font-weight:500; color:#2a1d10; font-size:15px; line-height:1.7; padding:0 32px 6px;">
              <strong>Afternoons</strong> (Ages 7&ndash;12) &middot; 5 sessions &mdash; half-price intro preview + 4-session chapter book project
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; font-weight:500; color:#3a2e1f; font-size:14px; line-height:1.7; padding:0 32px 22px;">
              May 31 &rarr; Jun 28 &middot; Steamoji Bellevue &middot; Limited 4:1 small-class spots
            </td>
          </tr>

          <!-- CTA button -->
          <tr>
            <td align="center" style="padding:0 24px 36px;">
              <a href="${WORKSHOPS_URL}" style="display:inline-block; padding:14px 28px; background-color:#3F6B3A; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:15px; font-weight:600; letter-spacing:0.3px;">Reserve your spot &rarr;</a>
            </td>
          </tr>

          <!-- Spacer divider (matches Spark letter) -->
          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <div style="width:80px; height:1px; background-color:#D9C9A8; line-height:1px; font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <!-- Footer (matches Spark letter pattern) -->
          <tr>
            <td align="center" style="padding:8px 24px 36px; border-top:1px solid #E5D8BD;">
              <div style="font-family:${CURSIVE}; font-weight:700; color:#2a1d10; font-size:22px; padding:24px 0 6px;">
                Happy storytelling!
              </div>
              <div style="font-family:${BODY}; font-weight:500; color:#5a4a3a; font-size:14px; padding-bottom:18px;">
                &mdash; The KindleWood Team
              </div>
              <div style="font-family:${BODY}; font-weight:500; font-size:14px; color:#3a2e1f; padding-bottom:14px;">
                <a href="${SITE_URL}" style="color:#8B4513; text-decoration:underline;">kindlewoodstudio.ai</a>
                &nbsp;&middot;&nbsp;
                <a href="${YT_URL}" style="color:#8B4513; text-decoration:underline;">YouTube</a>
              </div>
              <div style="font-family:${BODY}; font-size:12px; color:#6a5a47;">
                Questions? Simply reply to this email.
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeUrl}" style="color:#6a5a47; text-decoration:underline;">Unsubscribe</a>
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

function buildText(unsubscribeUrl: string): string {
  return `Thank you for being part of our KindleWood families — it means a lot to us.

We're excited to share that our Creative Storyteller Summer Series, co-hosted by KindleWood × Steamoji, is back — five Sundays starting Sunday, May 31 at the Steamoji Bellevue lab.

Here's the full lineup:

  Mornings (Ages 4–6) · 4 sessions across 2 topic pairs
  Afternoons (Ages 7–12) · 5 sessions — half-price intro preview + 4-session chapter book project
  May 31 → Jun 28 · Steamoji Bellevue · Limited 4:1 small-class spots

Reserve your spot: ${WORKSHOPS_URL}

Happy storytelling!
— The KindleWood Team

${SITE_URL}  ·  ${YT_URL}

Questions? Simply reply to this email.
Unsubscribe: ${unsubscribeUrl}
`;
}

