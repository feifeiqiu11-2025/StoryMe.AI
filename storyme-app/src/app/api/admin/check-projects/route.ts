import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Check all projects in database
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Get ALL projects (no status filter)
    const { data: allProjects, error: allError } = await supabase
      .from('projects')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false });

    if (allError) {
      return NextResponse.json({ error: allError.message }, { status: 500 });
    }

    // Get projects with scenes
    const { data: withScenes, error: scenesError } = await supabase
      .from('projects')
      .select(`
        id,
        title,
        status,
        scenes (
          id,
          scene_number,
          generated_images (id, image_url, status)
        )
      `)
      .order('created_at', { ascending: false });

    if (scenesError) {
      return NextResponse.json({ error: scenesError.message }, { status: 500 });
    }

    return NextResponse.json({
      totalProjects: allProjects?.length || 0,
      allProjects: allProjects || [],
      projectsWithDetails: withScenes?.map(p => ({
        id: p.id,
        title: p.title,
        status: p.status,
        sceneCount: p.scenes?.length || 0,
        imageCount: p.scenes?.reduce((acc: number, s: any) =>
          acc + (s.generated_images?.length || 0), 0) || 0,
      })) || [],
    });
  } catch (error) {
    console.error('Error checking projects:', error);
    return NextResponse.json(
      { error: 'Failed to check projects' },
      { status: 500 }
    );
  }
}
