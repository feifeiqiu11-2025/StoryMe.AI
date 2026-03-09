/**
 * Resend Email Client
 *
 * Shared Resend instance for transactional emails.
 * Requires RESEND_API_KEY environment variable.
 */

import { Resend } from 'resend';

// Use fallback to prevent build-time crash when env var is unavailable
export const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

export const EMAIL_FROM = 'KindleWood Studio <admin@kindlewoodstudio.ai>';
