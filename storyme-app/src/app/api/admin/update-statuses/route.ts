import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin endpoint to update project statuses to 'completed'
 * This is a one-time utility endpoint
 */
export async function POST() {
  try {
    const supabase = await createClient();

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
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    const results = [];

    for (const project of projects || []) {
      const hasScenes = project.scenes && project.scenes.length > 0;
      const hasImages = hasScenes && project.scenes.some((scene: any) =>
        scene.generated_images && scene.generated_images.length > 0
      );

      const info = {
        id: project.id,
        title: project.title || 'Untitled',
        currentStatus: project.status,
        scenes: project.scenes?.length || 0,
        hasImages,
        updated: false,
      };

      // Update to completed if it has scenes with images
      if (hasImages && project.status !== 'completed') {
        const { error: updateError } = await supabase
          .from('projects')
          .update({ status: 'completed' })
          .eq('id', project.id);

        if (!updateError) {
          info.updated = true;
        }
      }

      results.push(info);
    }

    return NextResponse.json({
      success: true,
      totalProjects: projects?.length || 0,
      results,
    });
  } catch (error) {
    console.error('Error updating statuses:', error);
    return NextResponse.json(
      { error: 'Failed to update statuses' },
      { status: 500 }
    );
  }
}
