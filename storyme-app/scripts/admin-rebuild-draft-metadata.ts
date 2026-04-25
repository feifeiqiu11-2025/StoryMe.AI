/**
 * Admin one-off: rebuild a completed project's `draft_metadata` so the /create
 * page's resume-draft flow can re-hydrate state. Same logic as the admin
 * "Edit story" PATCH handler, runnable from the CLI without a browser session.
 *
 * Use cases:
 *   - A completed story you want to edit, where the UI button isn't usable.
 *   - A project already in `status='draft'` but with `draft_metadata = null`
 *     (e.g., manually reverted before the rebuild code shipped).
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/admin-rebuild-draft-metadata.ts <projectId>
 *
 * Then visit:
 *   /create?projectId=<projectId>
 *
 * Service-role key only — does NOT do an ownership check. For internal admin use.
 */

import { createClient } from '@supabase/supabase-js';

const PROJECT_ID = process.argv[2];
if (!PROJECT_ID) {
  console.error('Usage: npx tsx scripts/admin-rebuild-draft-metadata.ts <projectId>');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

async function rebuild(): Promise<void> {
  console.log(`Rebuilding draft_metadata for project ${PROJECT_ID}...`);

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', PROJECT_ID)
    .single();
  if (pErr || !project) {
    console.error('Project not found:', pErr?.message ?? 'no row');
    process.exit(1);
  }

  if (project.visibility === 'public') {
    console.error('Refusing to rebuild: project is currently public. Make it private first.');
    process.exit(1);
  }

  const [{ data: projectCharacters }, { data: scenesData }, { data: storyLocations }] = await Promise.all([
    supabase
      .from('project_characters')
      .select('*, character:character_library(*)')
      .eq('project_id', PROJECT_ID)
      .order('order_index', { ascending: true, nullsFirst: false }),
    supabase
      .from('scenes')
      .select('*, images:generated_images(*)')
      .eq('project_id', PROJECT_ID)
      .order('scene_number', { ascending: true }),
    supabase
      .from('story_locations')
      .select('*')
      .eq('project_id', PROJECT_ID)
      .is('deleted_at', null)
      .order('first_scene_index', { ascending: true, nullsFirst: false }),
  ]);

  const characterIdToName = new Map<string, string>();
  for (const pc of projectCharacters || []) {
    if (pc.character?.id && pc.character?.name) {
      characterIdToName.set(pc.character.id, pc.character.name);
    }
  }

  const characters = (projectCharacters || []).map((pc: any) => ({
    id: pc.character.id,
    name: pc.character.name,
    referenceImage: {
      url: pc.character.reference_image_url || '',
      fileName: pc.character.reference_image_filename || '',
    },
    animatedPreviewUrl: pc.character.animated_preview_url,
    description: {
      hairColor: pc.character.hair_color,
      skinTone: pc.character.skin_tone,
      clothing: pc.character.clothing,
      age: pc.character.age,
      otherFeatures: pc.character.other_features,
      subjectType: pc.character.subject_type,
    },
    isPrimary: pc.is_primary,
    order: pc.order_index || 0,
    isFromLibrary: true,
  }));

  const namesForScene = (scene: any): string[] => {
    const ids: string[] =
      Array.isArray(scene.resolved_character_ids) && scene.resolved_character_ids.length > 0
        ? scene.resolved_character_ids
        : Array.isArray(scene.character_ids) ? scene.character_ids : [];
    return ids
      .map((id) => characterIdToName.get(id))
      .filter((n): n is string => typeof n === 'string');
  };

  const enhancedScenes = (scenesData || []).map((scene: any) => {
    const isCover = scene.scene_number === 0;
    return {
      sceneNumber: scene.scene_number,
      raw_description: scene.raw_description || '',
      enhanced_prompt: scene.enhanced_prompt || '',
      caption: scene.caption || '',
      caption_chinese: scene.caption_chinese,
      caption_secondary: scene.caption_secondary,
      characterNames: namesForScene(scene),
      ...(isCover ? {
        isCover: true,
        storyTitle: project.title,
        storyDescription: project.description,
      } : {}),
    };
  });

  const imageGenerationStatus = (scenesData || []).flatMap((scene: any) => {
    const firstImage = (scene.images && scene.images[0]) || null;
    if (!firstImage) return [];
    return [{
      id: firstImage.id,
      sceneId: scene.id,
      sceneNumber: scene.scene_number,
      sceneDescription: scene.caption || scene.description || '',
      imageUrl: firstImage.image_url,
      prompt: firstImage.prompt,
      generationTime: firstImage.generation_time,
      status: firstImage.status,
    }];
  });

  // Cover image synthesis. Covers live on `project.cover_image_url` and are NOT stored as
  // `scene_number = 0` in the scenes table. So if no cover scene exists but the project has
  // a cover URL, prepend a synthetic cover entry to enhancedScenes + imageGenerationStatus.
  const hasCoverScene = enhancedScenes.some((s: any) => s.sceneNumber === 0);
  if (!hasCoverScene && project.cover_image_url) {
    enhancedScenes.unshift({
      sceneNumber: 0,
      isCover: true,
      storyTitle: project.title,
      storyDescription: project.description,
      raw_description: '',
      enhanced_prompt: '',
      caption: '',
      characterNames: characters.map((c) => c.name),
    });
    imageGenerationStatus.unshift({
      id: `cover-${PROJECT_ID}`,
      sceneId: `cover-${PROJECT_ID}`,
      sceneNumber: 0,
      sceneDescription: project.title,
      imageUrl: project.cover_image_url,
      prompt: '',
      generationTime: 0,
      status: 'completed',
    });
  }

  let storyBible: any = null;
  if (storyLocations && storyLocations.length > 0) {
    const locations = storyLocations.map((loc: any) => ({
      temp_id: loc.id,
      name: loc.name,
      description: loc.description,
      backing_character_name: loc.backing_character_id
        ? (characterIdToName.get(loc.backing_character_id) ?? null)
        : null,
      first_scene_index: loc.first_scene_index ?? 0,
      reference_image_url: loc.reference_image_url ?? null,
    }));

    const bibleScenes = (scenesData || []).map((scene: any) => ({
      sceneNumber: scene.scene_number,
      raw_description: scene.raw_description || '',
      enhanced_prompt: scene.enhanced_prompt || '',
      caption: scene.caption || '',
      characterNames: namesForScene(scene),
      location_temp_id: scene.location_id ?? null,
      resolved_character_names: namesForScene(scene),
    }));

    storyBible = { locations, scenes: bibleScenes };
  }

  const draftMetadata = {
    characters,
    enhancedScenes,
    imageGenerationStatus,
    storyBible,
    storyTone: project.story_tone,
    contentLanguage: project.content_language || 'en',
    secondaryLanguage: project.secondary_language ?? null,
    clothingConsistency: 'consistent',
    expansionLevel: 'as_written',
    artStyle: 'pixar',
    selectedTemplate: null,
    authorName: project.author_name,
    authorAge: project.author_age,
    _rebuiltFromCompleted: true,
    _rebuiltViaScript: true,
    _rebuiltAt: new Date().toISOString(),
  };

  const { error: uErr } = await supabase
    .from('projects')
    .update({ status: 'draft', draft_metadata: draftMetadata })
    .eq('id', PROJECT_ID);
  if (uErr) {
    console.error('Failed to update project:', uErr.message);
    process.exit(1);
  }

  console.log(`✓ Project ${PROJECT_ID} rebuilt:`);
  console.log(`  - ${characters.length} characters`);
  console.log(`  - ${enhancedScenes.length} enhanced scenes`);
  console.log(`  - ${imageGenerationStatus.length} generated images`);
  console.log(`  - storyBible: ${storyBible ? `${storyBible.locations.length} locations` : 'null'}`);
  console.log(`  - status set to 'draft'`);
  console.log(`\nNow open: /create?projectId=${PROJECT_ID}`);
}

rebuild().catch((err) => {
  console.error('Rebuild failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
