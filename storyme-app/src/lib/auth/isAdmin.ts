/**
 * Shared admin authorization utility.
 * Used across character and story admin features (featured toggle, tagging, etc.)
 */

const ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'admin@kindlewoodstudio.ai',
];

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
