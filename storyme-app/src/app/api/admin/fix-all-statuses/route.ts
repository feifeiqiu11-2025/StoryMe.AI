import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Force update ALL projects to completed status if they have images
 * No filters - fixes everything
 */
export async function POST() {
  try {
    const supabase = await createClient();

    // First, let's see what's in the database at all
    const { data: allData, error: countError } = await supabase
      .from('projects')
      .select('*', { count: 'exact' });

    console.log('Total projects in DB:', allData?.length || 0);

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    // Get ALL projects from ALL users (no auth filter)
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select(`
        id,
        user_id,
        title,
        status,
        created_at,
        scenes (
          id,
          scene_number,
          generated_images (
            id,
            image_url,
            status
          )
        )
      `)
      .order('created_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log('Projects fetched:', projects?.length || 0);

    const updates = [];

    for (const project of projects || []) {
      const sceneCount = project.scenes?.length || 0;
      const imageCount = project.scenes?.reduce((acc: number, scene: any) => {
        return acc + (scene.generated_images?.length || 0);
      }, 0) || 0;

      const shouldBeCompleted = sceneCount > 0 && imageCount > 0;

      console.log(`Project: ${project.title}`);
      console.log(`  Scenes: ${sceneCount}, Images: ${imageCount}`);
      console.log(`  Current status: ${project.status}`);
      console.log(`  Should be completed: ${shouldBeCompleted}`);

      if (shouldBeCompleted && project.status !== 'completed') {
        // Update to completed
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: 'completed' })
          .eq('id', project.id);

        if (updateError) {
          console.error(`Failed to update ${project.id}:`, updateError);
          updates.push({
            id: project.id,
            title: project.title,
            success: false,
            error: updateError.message,
          });
        } else {
          console.log(`✅ Updated ${project.title} to completed`);
          updates.push({
            id: project.id,
            title: project.title,
            success: true,
            oldStatus: project.status,
            newStatus: 'completed',
            scenes: sceneCount,
            images: imageCount,
          });
        }
      } else {
        updates.push({
          id: project.id,
          title: project.title,
          success: false,
          reason: project.status === 'completed'
            ? 'Already completed'
            : `Not enough data (scenes: ${sceneCount}, images: ${imageCount})`,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalProjects: projects?.length || 0,
      updated: updates.filter(u => u.success).length,
      updates,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
