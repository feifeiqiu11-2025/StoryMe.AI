/**
 * Backfill: convert `data:` URLs stored in character_library.animated_preview_url
 * and reference_image_url to real Supabase Storage URLs.
 *
 * Why: the image-gen pipeline historically validated URLs by file-extension,
 * silently rejecting inline base64 blobs. Even with the validator + URL
 * builder now accepting `data:`, having real storage URLs in the DB
 * - keeps row payloads small (was ~1 MB/character bloating the table)
 * - lets the picker UI use thumbnail transforms (works only on Supabase URLs)
 * - normalizes downstream code paths.
 *
 * Strategy:
 *   for each row r with a data: URL in either column:
 *     fetch(dataUrl) -> ArrayBuffer
 *     upload to bucket 'character-images' at `${user_id}/${kind}-${id}-${Date.now()}.{ext}`
 *     update column to the public URL
 *   columns are handled independently.
 *
 * Idempotent: rows already storing storage URLs are skipped.
 *
 * Usage:
 *   npx tsx scripts/backfill-data-url-characters.ts            # dry-run, lists targets
 *   npx tsx scripts/backfill-data-url-characters.ts --apply    # do it
 *   npx tsx scripts/backfill-data-url-characters.ts --apply --limit 5   # process at most 5 rows
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const APPLY = process.argv.includes('--apply');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

const BUCKET = 'character-images';

function extToFromMime(mime: string): string {
  if (mime.startsWith('image/png')) return 'png';
  if (mime.startsWith('image/jpeg') || mime.startsWith('image/jpg')) return 'jpg';
  if (mime.startsWith('image/webp')) return 'webp';
  if (mime.startsWith('image/gif')) return 'gif';
  return 'png';
}

async function uploadDataUrl(dataUrl: string, userId: string, rowId: string, kind: 'animated-preview' | 'reference'): Promise<string> {
  // Parse: data:image/jpeg;base64,<...>
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error(`Not a base64 data URL`);
  const mime = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64, 'base64');
  const ext = extToFromMime(mime);
  const filePath = `${userId}/${kind}-${rowId}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, buf, { contentType: mime, upsert: false });
  if (upErr) throw new Error(`storage upload failed: ${upErr.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return urlData.publicUrl;
}

async function main() {
  const { data, error } = await supabase
    .from('character_library')
    .select('id, name, user_id, reference_image_url, animated_preview_url, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Select failed:', error);
    process.exit(1);
  }

  const rows = (data || []).filter(r =>
    (r.reference_image_url && r.reference_image_url.startsWith('data:')) ||
    (r.animated_preview_url && r.animated_preview_url.startsWith('data:'))
  );

  console.log(`Rows with data: URLs: ${rows.length}`);
  if (rows.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  if (!APPLY) {
    for (const r of rows.slice(0, 25)) {
      const refIsData = !!(r.reference_image_url && r.reference_image_url.startsWith('data:'));
      const prevIsData = !!(r.animated_preview_url && r.animated_preview_url.startsWith('data:'));
      console.log(`  ${r.name.padEnd(28)}  ref=${refIsData ? 'data' : '----'}  preview=${prevIsData ? 'data' : '----'}  user=${r.user_id}  id=${r.id}`);
    }
    if (rows.length > 25) console.log(`  …and ${rows.length - 25} more`);
    console.log('');
    console.log('Dry-run. Add --apply to perform uploads + updates.');
    return;
  }

  let processed = 0;
  let okCount = 0;
  let failCount = 0;
  const startedAt = Date.now();

  for (const r of rows) {
    if (processed >= LIMIT) break;
    processed++;

    const updates: { reference_image_url?: string; animated_preview_url?: string } = {};
    try {
      if (r.reference_image_url && r.reference_image_url.startsWith('data:')) {
        updates.reference_image_url = await uploadDataUrl(r.reference_image_url, r.user_id, r.id, 'reference');
      }
      if (r.animated_preview_url && r.animated_preview_url.startsWith('data:')) {
        updates.animated_preview_url = await uploadDataUrl(r.animated_preview_url, r.user_id, r.id, 'animated-preview');
      }

      const { error: upErr } = await supabase
        .from('character_library')
        .update(updates)
        .eq('id', r.id);
      if (upErr) throw new Error(`update failed: ${upErr.message}`);

      okCount++;
      console.log(`  [${processed}/${rows.length}] OK   ${r.name.padEnd(28)} ${Object.keys(updates).join(', ')}`);
    } catch (err: any) {
      failCount++;
      console.log(`  [${processed}/${rows.length}] FAIL ${r.name.padEnd(28)} ${err?.message || err}`);
    }
  }

  console.log('');
  console.log(`Processed: ${processed}  ok: ${okCount}  failed: ${failCount}  in ${(Date.now() - startedAt) / 1000}s`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
