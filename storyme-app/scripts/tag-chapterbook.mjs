/**
 * One-off: tag specific projects with the 'custom-chapterbook' tag so
 * they surface in the community Chapter Stories row.
 *
 * Run: node --env-file=.env.local scripts/tag-chapterbook.mjs
 */

import { createClient } from '@supabase/supabase-js';

const PROJECT_IDS = [
  'd25ad1ce-ef9d-457c-9073-3266a4ac599c',
  '7fdf7261-8f9d-47d2-95a1-074ae8a8264c',
  '0c1ca84c-fbd3-4e97-8e08-4b4b3bf6cbaa',
  '632922ce-6bb1-45c4-8478-2a26d1851e70',
];

const TAG_SLUG = 'custom-chapterbook';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // 1. Find the tag id.
  const { data: tagRows, error: tagErr } = await supabase
    .from('story_tags')
    .select('id, slug, name')
    .eq('slug', TAG_SLUG)
    .limit(1);
  if (tagErr) throw tagErr;
  if (!tagRows || tagRows.length === 0) {
    throw new Error(`Tag with slug "${TAG_SLUG}" not found`);
  }
  const tagId = tagRows[0].id;
  console.log(`Tag found: id=${tagId} name="${tagRows[0].name}" slug=${TAG_SLUG}`);

  // 2. Verify the projects exist (helps catch typo'd ids before insert).
  const { data: projectRows, error: projErr } = await supabase
    .from('projects')
    .select('id, title, project_type')
    .in('id', PROJECT_IDS);
  if (projErr) throw projErr;
  const foundIds = new Set((projectRows ?? []).map((p) => p.id));
  for (const id of PROJECT_IDS) {
    if (!foundIds.has(id)) {
      console.warn(`  ! Project ${id} not found — skipping`);
    }
  }
  for (const p of projectRows ?? []) {
    console.log(`  → ${p.id} ${p.project_type}: ${p.title}`);
  }

  // 3. Upsert the link rows. project_tags has a unique (project_id, tag_id)
  //    so upsert is idempotent — running this twice doesn't double-tag.
  const rows = (projectRows ?? []).map((p) => ({
    project_id: p.id,
    tag_id: tagId,
  }));
  if (rows.length === 0) {
    console.log('Nothing to insert.');
    return;
  }
  const { error: upErr } = await supabase
    .from('project_tags')
    .upsert(rows, { onConflict: 'project_id,tag_id' });
  if (upErr) throw upErr;

  console.log(`\nTagged ${rows.length} project(s) with "${TAG_SLUG}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
