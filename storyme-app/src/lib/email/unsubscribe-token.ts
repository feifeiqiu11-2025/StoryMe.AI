/**
 * Stateless HMAC-based unsubscribe token utility.
 *
 * Token format: base64url(email).base64url(hmac_sha256_signature)
 * - No DB storage needed — tokens are computed on-the-fly.
 * - Constant-time comparison prevents timing attacks.
 * - No expiration — idempotent unsubscribe has no abuse vector.
 */

import crypto from 'crypto';

const HMAC_SECRET_KEY = 'UNSUBSCRIBE_HMAC_SECRET';

function getSecret(): string {
  const secret = process.env[HMAC_SECRET_KEY];
  if (!secret || secret.length < 32) {
    console.error(`[UNSUBSCRIBE] Missing or too-short ${HMAC_SECRET_KEY} env var (need >= 32 chars). Actual length: ${secret?.length ?? 0}`);
    throw new Error(`Missing or too-short ${HMAC_SECRET_KEY} env var (need >= 32 chars)`);
  }
  return secret;
}

/** Generate a signed unsubscribe token for the given email. */
export function generateUnsubscribeToken(email: string): string {
  const normalizedEmail = email.trim().toLowerCase();
  const payload = Buffer.from(normalizedEmail).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(normalizedEmail)
    .digest('base64url');
  return `${payload}.${signature}`;
}

/** Verify a token and extract the email. Returns { valid, email }. */
export function verifyUnsubscribeToken(token: string): { valid: boolean; email: string | null } {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return { valid: false, email: null };

  const payload = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  let email: string;
  try {
    email = Buffer.from(payload, 'base64url').toString('utf-8');
  } catch {
    return { valid: false, email: null };
  }

  if (!email.includes('@') || email.length > 320) {
    return { valid: false, email: null };
  }

  const expectedSignature = crypto
    .createHmac('sha256', getSecret())
    .update(email)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  const sigBuffer = Buffer.from(signature, 'base64url');
  const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

  if (sigBuffer.length !== expectedBuffer.length) {
    return { valid: false, email: null };
  }

  const isValid = crypto.timingSafeEqual(sigBuffer, expectedBuffer);
  return { valid: isValid, email: isValid ? email : null };
}

/** Build a full unsubscribe URL for use in emails. */
export function buildUnsubscribeUrl(email: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.kindlewoodstudio.ai';
  const token = generateUnsubscribeToken(email);
  return `${baseUrl}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Get List-Unsubscribe headers for RFC 8058 compliance (Gmail/Outlook native button). */
export function getUnsubscribeHeaders(email: string): Record<string, string> {
  const url = buildUnsubscribeUrl(email);
  return {
    'List-Unsubscribe': `<${url}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
