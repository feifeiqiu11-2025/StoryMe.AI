/**
 * Script to update project status to 'completed'
 * Usage: npx tsx scripts/update-project-status.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function updateProjectStatuses() {
  try {
    // Get all projects with scenes and images
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        status,
        created_at,
        scenes (
          id,
          generated_images (id, image_url, status)
        )
      `)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching projects:', fetchError);
      return;
    }

    console.log(`Found ${projects?.length || 0} projects\n`);

    for (const project of projects || []) {
      const hasScenes = project.scenes && project.scenes.length > 0;
      const hasImages = hasScenes && project.scenes.some((scene: any) =>
        scene.generated_images && scene.generated_images.length > 0
      );

      console.log(`Project: ${project.title || 'Untitled'}`);
      console.log(`  ID: ${project.id}`);
      console.log(`  Current Status: ${project.status}`);
      console.log(`  Scenes: ${project.scenes?.length || 0}`);
      console.log(`  Has Images: ${hasImages ? 'Yes' : 'No'}`);

      // Update to completed if it has scenes with images
      if (hasImages && project.status !== 'completed') {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: 'completed' })
          .eq('id', project.id);

        if (updateError) {
          console.error(`  ❌ Error updating: ${updateError.message}`);
        } else {
          console.log(`  ✅ Updated status to 'completed'`);
        }
      } else if (project.status === 'completed') {
        console.log(`  ✓ Already completed`);
      } else {
        console.log(`  ⚠ Skipping (no images yet)`);
      }
      console.log('');
    }

    console.log('Done!');
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

updateProjectStatuses();
