/**
 * Backfill: for character_library rows where role='scene_element' but
 * subject_type is something other than 'scenery', set subject_type='scenery'.
 *
 * Bucket 2 from check-character-role-subject-mismatch — user explicitly said
 * scene_element, so we trust that and normalize subject_type to match.
 *
 * Idempotent — safe to re-run.
 *
 * Usage:
 *   cd storyme-app
 *   npx tsx scripts/fix-scene-element-subject-type.ts
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: before, error: selErr } = await supabase
    .from('character_library')
    .select('id, name, user_id, role, subject_type')
    .eq('role', 'scene_element')
    .neq('subject_type', 'scenery');

  if (selErr) {
    console.error('Select failed:', selErr);
    process.exit(1);
  }

  console.log(`Rows to fix: ${before?.length ?? 0}`);
  for (const r of before || []) {
    console.log(`  ${r.name.padEnd(30)}  subject_type=${r.subject_type}  id=${r.id}`);
  }

  if (!before || before.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const ids = before.map(r => r.id);
  const { error: updErr, count } = await supabase
    .from('character_library')
    .update({ subject_type: 'scenery' }, { count: 'exact' })
    .in('id', ids);

  if (updErr) {
    console.error('Update failed:', updErr);
    process.exit(1);
  }

  console.log('');
  console.log(`Updated: ${count ?? 'unknown'} rows`);

  // Verify
  const { data: after, error: vErr } = await supabase
    .from('character_library')
    .select('id')
    .eq('role', 'scene_element')
    .neq('subject_type', 'scenery');

  if (vErr) {
    console.error('Verify failed:', vErr);
    process.exit(1);
  }
  console.log(`Remaining inconsistent (scene_element + non-scenery): ${after?.length ?? 0}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
