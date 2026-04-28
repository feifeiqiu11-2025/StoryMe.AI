/**
 * Shared admin authorization utility.
 * Used across all admin pages and API routes — adding an admin is one line here.
 */

const DEFAULT_ADMIN_EMAILS = [
  'feifei_qiu@hotmail.com',
  'admin@kindlewoodstudio.ai',
  'panglu7373@gmail.com',
];

const ENV_ADMIN_EMAILS = (
  process.env.ADMIN_EMAILS ||
  process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
  ''
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_EMAILS = new Set<string>([
  ...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
  ...ENV_ADMIN_EMAILS,
]);

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
