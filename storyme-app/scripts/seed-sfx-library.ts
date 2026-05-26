/**
 * Seed the sfx_library table + storage bucket with curated CC0 sounds from
 * Freesound. Reads scripts/sfx-seed-manifest.json — each entry has a name +
 * tag set + a Freesound search query. For each entry:
 *   1. Search Freesound CC0-only, sorted by rating
 *   2. Pick the top result whose duration is <= 30s (the sfx_library check
 *      constraint cap)
 *   3. Download the HQ MP3 preview, upload to our `sfx-library` bucket,
 *      insert into sfx_library with source='curated'
 *
 * Idempotent: re-running skips already-imported sounds (de-duped on
 * (source='curated', external_id=freesound_id) by the partial unique index).
 *
 * Usage:
 *   export FREESOUND_API_KEY=...
 *   export NEXT_PUBLIC_SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/seed-sfx-library.ts
 *
 * The service-role key is required because RLS blocks writes to sfx_library
 * and storage.objects for anon/auth roles by design.
 */

// Load .env.local explicitly — Next.js auto-loads this but standalone Node
// scripts don't, so without this the script can't see NEXT_PUBLIC_SUPABASE_URL
// or FREESOUND_API_KEY when run via `npm run seed-sfx`.
import { config as loadDotenv } from 'dotenv';
import { join } from 'path';
loadDotenv({ path: join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { searchCC0 } from '../src/lib/sfx/freesound-client';
import { importFreesoundSound } from '../src/lib/sfx/import-from-freesound';

interface ManifestEntry {
  name: string;
  tags: string[];
  query: string;
  sort?: 'score' | 'duration_asc' | 'rating_desc' | 'downloads_desc';
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(1);
  }
  if (!process.env.FREESOUND_API_KEY) {
    console.error('Missing FREESOUND_API_KEY — get one at https://freesound.org/apiv2/apply/');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const manifestPath = join(__dirname, 'sfx-seed-manifest.json');
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf8'));

  console.log(`📦 Seeding ${manifest.length} sounds from Freesound CC0...\n`);

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const errors: Array<{ entry: ManifestEntry; error: string }> = [];

  for (const entry of manifest) {
    try {
      const results = await searchCC0({
        query: entry.query,
        pageSize: 10,
        sort: entry.sort ?? 'rating_desc',
      });
      // Pick the highest-rated result short enough for our 30s cap. We
      // also skip the ABSOLUTE shortest results (<0.3s) which are usually
      // artifacts rather than usable sound effects.
      const pick = results.find((r) => r.duration >= 0.3 && r.duration <= 30);
      if (!pick) {
        console.warn(`  ⚠ ${entry.name}: no suitable result (query: "${entry.query}")`);
        skipped++;
        continue;
      }

      const result = await importFreesoundSound(supabase, pick, {
        overrideName: entry.name,
        extraTags: entry.tags,
        asCurated: true,
      });
      console.log(`  ✓ ${entry.name}  ←  Freesound #${pick.id} (${pick.duration.toFixed(1)}s)`);
      imported++;
      // Be gentle to Freesound's API — they rate-limit at 60 req/min.
      await new Promise((r) => setTimeout(r, 1100));
    } catch (err: any) {
      console.error(`  ✗ ${entry.name}: ${err.message}`);
      errors.push({ entry, error: err.message });
      failed++;
    }
  }

  console.log(`\n✅ Done. Imported: ${imported}  Skipped: ${skipped}  Failed: ${failed}`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    for (const e of errors) {
      console.log(`  - ${e.entry.name} ("${e.entry.query}"): ${e.error}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
