/**
 * Seed the sfx_library table with CC0 music tracks from Freesound, kind='music'.
 * Mirrors seed-sfx-library.ts but with two key differences:
 *   1. Reads music-seed-manifest.json (kid-safe mood-based queries)
 *   2. Filters results to 15-180s duration (music is longer than SFX)
 *   3. Passes kind='music' to importFreesoundSound so the row lands under
 *      the Music top-tab in the recorder browser
 *
 * Idempotent — re-running skips already-imported tracks (de-duped on
 * (source='curated', external_id=freesound_id)).
 *
 * Usage:
 *   export FREESOUND_API_KEY=...
 *   export NEXT_PUBLIC_SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   npx tsx scripts/seed-music-library.ts
 *
 * Note: the existing sfx_library.duration_sec column has a 30s cap inherited
 * from the SFX seed. The migration in 20260528 doesn't change that, so music
 * tracks longer than 30s get clamped on insert. If we want full-length music
 * preserved on disk, we can drop the cap in a follow-up — for now 30s is
 * enough for short scene underscoring.
 */

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

  const manifestPath = join(__dirname, 'music-seed-manifest.json');
  const manifest: ManifestEntry[] = JSON.parse(readFileSync(manifestPath, 'utf8'));

  console.log(`🎵 Seeding ${manifest.length} music tracks from Freesound CC0...\n`);

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
        // Music: 15-180s window. Excludes one-shots and ultra-long stems.
        minDurationSec: 15,
        maxDurationSec: 180,
      });
      // Pick the highest-rated result whose duration falls inside our
      // search range — the API filter is reliable but not bulletproof.
      const pick = results.find((r) => r.duration >= 15 && r.duration <= 180);
      if (!pick) {
        console.warn(`  ⚠ ${entry.name}: no suitable result (query: "${entry.query}")`);
        skipped++;
        continue;
      }

      const result = await importFreesoundSound(supabase, pick, {
        overrideName: entry.name,
        extraTags: entry.tags,
        asCurated: true,
        kind: 'music',
      });
      console.log(`  ✓ ${entry.name}  ←  Freesound #${pick.id} (${pick.duration.toFixed(1)}s)`);
      imported++;
      // Gentle on Freesound's 60 req/min rate limit.
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
