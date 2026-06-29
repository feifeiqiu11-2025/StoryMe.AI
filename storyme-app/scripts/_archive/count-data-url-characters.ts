/**
 * Count character_library rows whose image URLs are stored as inline
 * `data:image/...` blobs instead of Supabase Storage URLs. These are
 * silently rejected by the image-gen validator, so the model has no
 * visual anchor for the character.
 *
 * Read-only. Usage:
 *   npx tsx scripts/count-data-url-characters.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
function loadEnv() {
  const p = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}
loadEnv();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // Pull just the URL prefixes so we don't ship MB of base64 over the wire.
  const { data, error } = await sb.from('character_library')
    .select('id, name, user_id, role, subject_type, reference_image_url, animated_preview_url, created_at')
    .order('created_at', { ascending: false });
  if (error) { console.error(error); process.exit(1); }
  const rows = data || [];

  const prefix = (s: string | null | undefined) =>
    !s ? '(null)' : s.startsWith('data:') ? 'data:' : s.startsWith('http') ? 'http' : 'other';

  let refData = 0, refHttp = 0, refNone = 0, refOther = 0;
  let prevData = 0, prevHttp = 0, prevNone = 0, prevOther = 0;
  // Affected = has SOME image but NONE of them are storage URLs the validator accepts.
  const affected: typeof rows = [];

  for (const r of rows) {
    const refP = prefix(r.reference_image_url);
    const prevP = prefix(r.animated_preview_url);

    if (refP === 'data:') refData++; else if (refP === 'http') refHttp++; else if (refP === '(null)') refNone++; else refOther++;
    if (prevP === 'data:') prevData++; else if (prevP === 'http') prevHttp++; else if (prevP === '(null)') prevNone++; else prevOther++;

    const hasAnyImage = !!(r.reference_image_url || r.animated_preview_url);
    const hasStorageUrl = refP === 'http' || prevP === 'http';
    if (hasAnyImage && !hasStorageUrl) affected.push(r);
  }

  console.log(`Total characters: ${rows.length}`);
  console.log('');
  console.log('reference_image_url:');
  console.log(`  http:    ${refHttp}`);
  console.log(`  data:    ${refData}`);
  console.log(`  null:    ${refNone}`);
  console.log(`  other:   ${refOther}`);
  console.log('');
  console.log('animated_preview_url:');
  console.log(`  http:    ${prevHttp}`);
  console.log(`  data:    ${prevData}`);
  console.log(`  null:    ${prevNone}`);
  console.log(`  other:   ${prevOther}`);
  console.log('');
  console.log(`Characters with image(s) but NO storage URL (image-gen rejects all): ${affected.length}`);
  console.log('');
  for (const a of affected.slice(0, 25)) {
    const ref = prefix(a.reference_image_url);
    const prev = prefix(a.animated_preview_url);
    console.log(`  ${a.name.padEnd(28)} ref=${ref.padEnd(7)} preview=${prev.padEnd(7)} role=${String(a.role).padEnd(15)} subject_type=${a.subject_type}  user=${a.user_id}`);
  }
  if (affected.length > 25) console.log(`  …and ${affected.length - 25} more`);
}

main().catch(console.error);
