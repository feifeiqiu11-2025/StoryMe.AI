/**
 * Diagnostic: dump a project's scenes / generated_images / rebuilt draft_metadata so
 * we can verify a rebuild produced the expected cover scene + image references.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/check-cover.ts <projectId>
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const PROJECT_ID = process.argv[2];
if (!PROJECT_ID) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/check-cover.ts <projectId>');
  process.exit(1);
}

async function main() {
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, cover_image_url, status')
    .eq('id', PROJECT_ID)
    .single();
  console.log('PROJECT:', project);

  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, scene_number, caption, raw_description')
    .eq('project_id', PROJECT_ID)
    .order('scene_number', { ascending: true });
  console.log('\nSCENES:');
  scenes?.forEach((s: any) => console.log(`  [${s.scene_number}] id=${s.id.slice(0, 8)} caption="${(s.caption || '').slice(0, 50)}"`));

  const { data: images } = await supabase
    .from('generated_images')
    .select('id, scene_id, image_url, status, scenes!inner(scene_number)')
    .eq('project_id', PROJECT_ID);
  console.log('\nGENERATED IMAGES:');
  images?.forEach((img: any) => console.log(`  scene#${img.scenes.scene_number} status=${img.status} url=${(img.image_url || '').slice(0, 80)}...`));

  const { data: rebuilt } = await supabase
    .from('projects')
    .select('draft_metadata')
    .eq('id', PROJECT_ID)
    .single();
  const meta: any = rebuilt?.draft_metadata;
  console.log('\nREBUILT META:');
  console.log(`  enhancedScenes count = ${meta?.enhancedScenes?.length}`);
  const cover = meta?.enhancedScenes?.find((s: any) => s.sceneNumber === 0);
  console.log(`  scene 0 in enhancedScenes:`, cover ? `isCover=${cover.isCover}, storyTitle="${cover.storyTitle}"` : 'MISSING');
  const coverImg = meta?.imageGenerationStatus?.find((i: any) => i.sceneNumber === 0);
  console.log(`  scene 0 in imageGenerationStatus:`, coverImg ? `imageUrl="${(coverImg.imageUrl || '').slice(0, 80)}..."` : 'MISSING');
}

main().catch((e) => { console.error(e); process.exit(1); });
