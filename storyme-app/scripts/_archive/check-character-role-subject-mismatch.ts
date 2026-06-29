/**
 * Diagnostic: count and list character_library rows where `role` and
 * `subject_type` disagree on whether the row is a scene/location.
 *
 *   role='character'     + subject_type='scenery'   → BUG (the Spark case)
 *   role='scene_element' + subject_type<>'scenery'  → INCONSISTENT
 *   role IS NULL         + subject_type='scenery'   → AMBIGUOUS (legacy rows)
 *
 * Read-only — just prints what's in the table.
 *
 * Usage:
 *   cd storyme-app
 *   npx tsx scripts/check-character-role-subject-mismatch.ts
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
  const { data, error } = await supabase
    .from('character_library')
    .select('id, name, user_id, role, subject_type, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Query failed:', error);
    process.exit(1);
  }

  const rows = data || [];
  const bugSparkLike = rows.filter(r => r.role === 'character' && r.subject_type === 'scenery');
  const sceneRoleNotScenery = rows.filter(r => r.role === 'scene_element' && r.subject_type !== 'scenery');
  const noRoleButScenery = rows.filter(r => !r.role && r.subject_type === 'scenery');

  console.log(`Total characters: ${rows.length}`);
  console.log('');
  console.log(`role='character' + subject_type='scenery' (Spark-like bug): ${bugSparkLike.length}`);
  console.log(`role='scene_element' + subject_type<>'scenery' (inconsistent): ${sceneRoleNotScenery.length}`);
  console.log(`role IS NULL + subject_type='scenery' (legacy, ambiguous): ${noRoleButScenery.length}`);
  console.log('');

  const dump = (label: string, list: typeof rows) => {
    if (list.length === 0) return;
    console.log(`--- ${label} ---`);
    for (const r of list) {
      console.log(`  ${r.name.padEnd(30)}  role=${String(r.role).padEnd(15)} subject_type=${r.subject_type}  user=${r.user_id}  id=${r.id}`);
    }
    console.log('');
  };

  dump('Spark-like bug rows (role=character, subject_type=scenery)', bugSparkLike);
  dump('Inconsistent (role=scene_element, subject_type<>scenery)', sceneRoleNotScenery);
  dump('Legacy (no role, subject_type=scenery)', noRoleButScenery);

  // Distribution snapshot for context.
  const byPair = new Map<string, number>();
  for (const r of rows) {
    const k = `role=${r.role ?? 'NULL'}  subject_type=${r.subject_type ?? 'NULL'}`;
    byPair.set(k, (byPair.get(k) ?? 0) + 1);
  }
  console.log('--- Distribution (role, subject_type) ---');
  for (const [k, n] of [...byPair.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${n.toString().padStart(5)}  ${k}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
