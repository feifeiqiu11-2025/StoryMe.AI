/**
 * Resend Email Client
 *
 * Shared Resend instance for transactional emails.
 * Requires RESEND_API_KEY environment variable.
 */

import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = 'KindleWood Studio <admin@kindlewoodstudio.ai>';
