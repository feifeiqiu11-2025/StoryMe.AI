/**
 * Shared unsubscribe footer HTML for marketing emails.
 * CAN-SPAM compliant: includes unsubscribe link.
 *
 * Returns inline HTML to be placed INSIDE the existing email footer <td>,
 * after the site links.
 */

import { buildUnsubscribeUrl } from './unsubscribe-token';

/** Returns inline HTML with unsubscribe link for the existing email footer. */
export function buildUnsubscribeFooter(email: string): string {
  const url = buildUnsubscribeUrl(email);
  return `
              <p style="color: #9ca3af; font-size: 12px; margin: 16px 0 0; line-height: 1.6;">
                Questions? Simply reply to this email.
                &nbsp;&middot;&nbsp;
                <a href="${url}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>`;
}
