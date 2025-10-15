import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

/**
 * Check for orphaned scenes/images and fix projects table
 * Uses service role to bypass RLS
 */
export async function GET() {
  try {
    const supabase = createServiceRoleClient();

    // Get scenes with their project IDs
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, project_id, scene_number');

    console.log('Scenes found:', scenes?.length);

    // Get unique project IDs from scenes
    const projectIds = [...new Set(scenes?.map(s => s.project_id) || [])];
    console.log('Unique project IDs:', projectIds);

    // Get projects
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .in('id', projectIds);

    console.log('Projects found:', projects?.length);

    // Get images
    const { data: images } = await supabase
      .from('generated_images')
      .select('id, project_id, scene_id, image_url, status');

    return NextResponse.json({
      sceneCount: scenes?.length || 0,
      uniqueProjectIds: projectIds,
      projectCount: projects?.length || 0,
      imageCount: images?.length || 0,
      projects: projects || [],
      scenes: scenes || [],
      images: images || [],
    });
  } catch (err) {
    console.error('Error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
