/**
 * Career fair follow-up — broadcast template for attendees who stopped by
 * the KindleWood Studio booth.
 *
 * Creamy palette inherited from spark-letter-1, but professional typography
 * (Inter / system sans-serif, no cursive headings) since the audience is
 * candidates and partners. Single CTA to the careers page, social links in
 * the footer.
 */

import { buildUnsubscribeUrl, getUnsubscribeHeaders } from './unsubscribe-token';

export const CAREER_FAIR_FOLLOWUP_CAMPAIGN_ID = 'career-fair-followup-2026-05';
export const CAREER_FAIR_FOLLOWUP_SUBJECT = 'Great meeting you at the career fair';
export const CAREER_FAIR_FOLLOWUP_PREHEADER =
  'A quick note from KindleWood Studio with next steps from our team.';

const CAREERS_URL = 'https://www.kindlewoodstudio.ai/careers';
const SITE_URL = 'https://www.kindlewoodstudio.ai';
const YT_URL = 'https://www.youtube.com/@KindleWoodStudio';
const LINKEDIN_URL = 'https://www.linkedin.com/company/kindlewoodstudio/';
const REPLY_EMAIL = 'admin@kindlewoodstudio.ai';

const BODY = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export interface RenderedCareerFairFollowup {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export function renderCareerFairFollowup(recipientEmail: string): RenderedCareerFairFollowup {
  const unsubscribeUrl = buildUnsubscribeUrl(recipientEmail);
  return {
    subject: CAREER_FAIR_FOLLOWUP_SUBJECT,
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
<title>${CAREER_FAIR_FOLLOWUP_SUBJECT}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#F5EBD6; font-family:${BODY};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:#F5EBD6; font-size:1px; line-height:1px;">
    ${CAREER_FAIR_FOLLOWUP_PREHEADER}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F5EBD6;">
    <tr>
      <td align="center" style="padding:36px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background-color:#FBF6EC; border-radius:14px;">

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:40px 32px 18px;">
              Hi there,
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 18px;">
              Thanks for stopping by our booth and taking the time to learn about KindleWood Studio &mdash; your interest and energy in shaping a new way of creative learning for kids really stood out.
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 22px;">
              A quick next step from our side: if you haven&rsquo;t already, please head over to our careers page, find the role that fits you best, and send us a short note about yourself.
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:4px 24px 28px;">
              <a href="${CAREERS_URL}" style="display:inline-block; padding:14px 28px; background-color:#A0552B; color:#FBF6EC; text-decoration:none; border-radius:8px; font-family:${BODY}; font-size:15px; font-weight:600; letter-spacing:0.2px;">Visit our careers page</a>
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 18px;">
              <strong style="color:#A0552B;">P.S.</strong> If you handed us a paper resume at the booth, thank you &mdash; we have it. A quick note through the careers page still helps so we have everything in one place and can come back to you with the right questions.
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 18px;">
              We&rsquo;ll review every applicant carefully and reach out with next steps within one to two weeks.
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 30px;">
              Looking forward to hearing more about you.
            </td>
          </tr>

          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 6px;">
              Warmly,
            </td>
          </tr>
          <tr>
            <td style="font-family:${BODY}; color:#3a2e1f; font-size:16px; line-height:1.7; padding:0 32px 36px;">
              The KindleWood Studio team
            </td>
          </tr>

          <tr>
            <td align="center" style="padding:24px 24px 32px; border-top:1px solid #E5D8BD;">
              <div style="font-family:${BODY}; font-size:14px; color:#5a4a3a; padding-bottom:12px;">
                <a href="${SITE_URL}" style="color:#A0552B; text-decoration:underline;">kindlewoodstudio.ai</a>
                &nbsp;&middot;&nbsp;
                <a href="${LINKEDIN_URL}" style="color:#A0552B; text-decoration:underline;">LinkedIn</a>
                &nbsp;&middot;&nbsp;
                <a href="${YT_URL}" style="color:#A0552B; text-decoration:underline;">YouTube</a>
              </div>
              <div style="font-family:${BODY}; font-size:13px; color:#7a6852; padding-bottom:12px;">
                Questions? Reply to this email or write to
                <a href="mailto:${REPLY_EMAIL}" style="color:#7a6852; text-decoration:underline;">${REPLY_EMAIL}</a>.
              </div>
              <div style="font-family:${BODY}; font-size:12px; color:#9a8a72;">
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
  return `Hi there,

Thanks for stopping by our booth and taking the time to learn about KindleWood Studio — your interest and energy in shaping a new way of creative learning for kids really stood out.

A quick next step from our side: if you haven't already, please head over to our careers page, find the role that fits you best, and send us a short note about yourself.

  ${CAREERS_URL}

P.S. If you handed us a paper resume at the booth, thank you — we have it. A quick note through the careers page still helps so we have everything in one place and can come back to you with the right questions.

We'll review every applicant carefully and reach out with next steps within one to two weeks.

Looking forward to hearing more about you.

Warmly,
The KindleWood Studio team

${SITE_URL}  ·  LinkedIn: ${LINKEDIN_URL}  ·  YouTube: ${YT_URL}

Questions? Reply to this email or write to ${REPLY_EMAIL}.

Unsubscribe: ${unsubscribeUrl}
`;
}
