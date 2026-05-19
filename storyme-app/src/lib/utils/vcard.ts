export interface VCardInput {
  fullName: string;
  organization?: string;
  title?: string;
  email?: string;
  url?: string;
}

export function buildVCard(input: VCardInput): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escape(input.fullName)}`];
  if (input.organization) lines.push(`ORG:${escape(input.organization)}`);
  if (input.title) lines.push(`TITLE:${escape(input.title)}`);
  if (input.email) lines.push(`EMAIL;TYPE=INTERNET:${escape(input.email)}`);
  if (input.url) lines.push(`URL:${escape(input.url)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function escape(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}
