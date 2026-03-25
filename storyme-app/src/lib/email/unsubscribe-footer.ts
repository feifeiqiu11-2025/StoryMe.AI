/**
 * Shared unsubscribe footer HTML for marketing emails.
 * CAN-SPAM compliant: includes unsubscribe link and physical address.
 */

import { buildUnsubscribeUrl } from './unsubscribe-token';

/** Returns an HTML table row with unsubscribe link + address for marketing emails. */
export function buildUnsubscribeFooter(email: string): string {
  const url = buildUnsubscribeUrl(email);
  return `
          <!-- Unsubscribe Footer -->
          <tr>
            <td style="padding: 16px 24px 8px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6;">
                You&rsquo;re receiving this email because you signed up for KindleWood Studio.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 4px 0 0; line-height: 1.6;">
                <a href="${url}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
                from marketing emails
              </p>
              <p style="color: #9ca3af; font-size: 11px; margin: 8px 0 0;">
                KindleWood Studio &middot; Bellevue, WA
              </p>
            </td>
          </tr>`;
}
