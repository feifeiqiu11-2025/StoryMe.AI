/**
 * Spark's first letter — marketing email broadcast template.
 *
 * Story-format product update introducing Spark (the dragon mascot born from
 * a four-year-old's bedtime story) and announcing the Android launch + Korean
 * language support + Discover circle.
 *
 * Mirrors the layout of welcome-email.ts: exports `renderSparkLetter1(email)`
 * returning { subject, html, text, headers } for the send endpoint to consume.
 *
 * Per-recipient unsubscribe URL is HMAC-signed via buildUnsubscribeUrl().
 * RFC 8058 List-Unsubscribe-Post headers are returned for Gmail/Outlook
 * one-click unsubscribe button.
 */

import { buildUnsubscribeUrl, getUnsubscribeHeaders } from './unsubscribe-token';

export const SPARK_LETTER_1_CAMPAIGN_ID = 'spark-letter-1';
export const SPARK_LETTER_1_SUBJECT = "Spark's first letter: KindleWood is on Android.";
export const SPARK_LETTER_1_PREHEADER = 'A note from a small dragon, with some big product news.';

const IMAGE_BASE = 'https://www.kindlewoodstudio.ai/email/spark-letter-1';
const COMIC_URL = `${IMAGE_BASE}/spark-comic.jpg`;
const DESK_URL = `${IMAGE_BASE}/spark-desk.png`;

const APP_STORE_URL = 'https://apps.apple.com/us/app/kindlewood-kids/id6755075039';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.kindlewood.kindlewood_kids';
const PRODUCTS_URL = 'https://www.kindlewoodstudio.ai/products';
const SITE_URL = 'https://www.kindlewoodstudio.ai';
const YT_URL = 'https://www.youtube.com/@KindleWoodStudio';

const CURSIVE = "'Caveat', 'Bradley Hand', 'Marker Felt', cursive";
const BODY = "'Quicksand', 'Trebuchet MS', 'Helvetica Neue', Arial, sans-serif";

export interface RenderedSparkLetter {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export function renderSparkLetter1(recipientEmail: string): RenderedSparkLetter {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  return {
    subject: SPARK_LETTER_1_SUBJECT,
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
<title>Spark's first letter</title>
<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @media only screen and (max-width: 480px) {
    .stack { display:block !important; width:100% !important; text-align:center !important; padding-left:0 !important; padding-right:0 !important; }
    .stack-img { margin:0 auto 12px auto !important; }
    .header-text { font-size:28px !important; line-height:1.35 !important; padding-top:8px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#F5EBD6; font-family:${BODY};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F5EBD6; font-size:1px; line-height:1px;">
    ${SPARK_LETTER_1_PREHEADER}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5EBD6;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FBF6EC; border-radius:14px;">

          <tr>
            <td style="padding:32px 28px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td class="stack" width="200" valign="middle" align="center" style="padding-right:8px;">
                    <img class="stack-img" src="${DESK_URL}" width="190" alt="Spark, a small green dragon, sitting at a wooden writing desk with a quill and a glowing lightbulb of imagination." style="display:block; width:190px; max-width:100%; height:auto; border:0;">
                  </td>
                  <td class="stack" valign="middle" style="padding-left:14px;">
                    <div class="header-text" style="font-family:${CURSIVE}; font-weight:600; font-size:32px; line-height:1.3; color:#3a2e1f;">
                      A note from a small dragon, with some <em style="color:#A0552B;">big</em> product news.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="font-family:${CURSIVE}; font-size:30px; color:#5a4a3a; padding:4px 24px 28px;">
              Best read aloud, with a kid in your lap.
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 16px 28px;">
              <a href="${PRODUCTS_URL}" style="text-decoration:none; display:block;">
                <img src="${COMIC_URL}" width="568" alt="A six-panel KindleWood comic. Once upon a time, a four-year-old whispered a story about a dragon named Spark. Spark grew bigger wings and is now on Google Play. He learned to speak Korean (안녕!) and gathered children's stories into a Discover circle on the App Store, available in English, Chinese, and Korean. Wherever you are — phone, tablet, or laptop — Spark is waiting." style="display:block; width:100%; max-width:568px; height:auto; border-radius:8px; border:0;">
              </a>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 24px 36px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">
                <tr>
                  <td style="padding:6px;">
                    <a href="${APP_STORE_URL}" style="display:inline-block; padding:13px 22px; background-color:#3F6B3A; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:14px; font-weight:600; letter-spacing:0.3px;">App Store</a>
                  </td>
                  <td style="padding:6px;">
                    <a href="${PLAY_STORE_URL}" style="display:inline-block; padding:13px 22px; background-color:#3F6B3A; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:14px; font-weight:600; letter-spacing:0.3px;">Google Play</a>
                  </td>
                  <td style="padding:6px;">
                    <a href="${PRODUCTS_URL}" style="display:inline-block; padding:13px 22px; background-color:#3F6B3A; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:14px; font-weight:600; letter-spacing:0.3px;">Open on Web</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:0 24px 24px;">
              <div style="width:80px; height:1px; background-color:#D9C9A8; line-height:1px; font-size:0;">&nbsp;</div>
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 18px;">
              <span style="font-family:${CURSIVE}; font-weight:700; font-size:22px; color:#A0552B;">P.S.</span> &mdash; Spark is a real character from a four-year-old's original story, whispered at bedtime almost a year ago. KindleWood exists so every child's dragon &mdash; every spaceship, every brave little mouse, every tiny adventure &mdash; can find its way into a real book they can hold.
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 18px;">
              Thank you for being part of his story.
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 36px;">
              <span style="font-family:${CURSIVE}; font-weight:700; font-size:22px; color:#A0552B;">P.P.S.</span> &mdash; Spark will be back soon with more news from the wood.
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:32px 24px 36px; border-top:1px solid #E5D8BD;">
              <div style="font-family:${CURSIVE}; font-weight:700; color:#3a2e1f; font-size:22px; padding-bottom:6px;">
                Happy storytelling!
              </div>
              <div style="font-family:${BODY}; color:#7a6852; font-size:14px; padding-bottom:18px;">
                &mdash; The KindleWood Team
              </div>
              <div style="font-family:${BODY}; font-size:14px; color:#5a4a3a; padding-bottom:14px;">
                <a href="${SITE_URL}" style="color:#A0552B; text-decoration:underline;">kindlewoodstudio.ai</a>
                &nbsp;&middot;&nbsp;
                <a href="${YT_URL}" style="color:#A0552B; text-decoration:underline;">YouTube</a>
              </div>
              <div style="font-family:${BODY}; font-size:12px; color:#9a8a72;">
                Questions? Simply reply to this email.
                &nbsp;&middot;&nbsp;
                <a href="${unsubscribeUrl}" style="color:#9a8a72; text-decoration:underline;">Unsubscribe</a>
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
  return `Spark's first letter — a note from a small dragon, with some big product news.

Once upon a time, in a quiet bedroom, a four-year-old whispered a story about a dragon...

His name was Spark. He came from a story.

Spark sparked another story, and another, until the bedroom couldn't hold them all — so a great wood was built for the dragons. We called it KindleWood.

This spring, Spark grew bigger wings and flew somewhere new.

— He's on Google Play now.
— He learned to speak Korean (안녕!).
— He gathered children's stories from around the world into a Discover circle in the iOS app, in English, Chinese, and Korean.

Wherever you are, Spark is waiting:
  App Store: ${APP_STORE_URL}
  Google Play: ${PLAY_STORE_URL}
  Open on Web: ${PRODUCTS_URL}

P.S. — Spark is a real character from a four-year-old's original story, whispered at bedtime almost a year ago. KindleWood exists so every child's dragon — every spaceship, every brave little mouse, every tiny adventure — can find its way into a real book they can hold.

Thank you for being part of his story.

P.P.S. — Spark will be back soon with more news from the wood.

Happy storytelling!
— The KindleWood Team

${SITE_URL}  ·  ${YT_URL}

Questions? Simply reply to this email.
Unsubscribe: ${unsubscribeUrl}
`;
}
