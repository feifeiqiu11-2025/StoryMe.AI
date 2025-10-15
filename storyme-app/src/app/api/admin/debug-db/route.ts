import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Debug: Check database contents with detailed logging
 */
export async function GET() {
  try {
    const supabase = await createClient();

    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('Current user:', user?.id, user?.email);

    // Check projects table directly
    const { data: projects, error, count } = await supabase
      .from('projects')
      .select('*', { count: 'exact' });

    console.log('Projects query error:', error);
    console.log('Projects count:', count);
    console.log('Projects data:', projects);

    // Check scenes
    const { data: scenes } = await supabase
      .from('scenes')
      .select('*');

    console.log('Scenes:', scenes?.length);

    // Check images
    const { data: images } = await supabase
      .from('generated_images')
      .select('*');

    console.log('Images:', images?.length);

    return NextResponse.json({
      user: user?.email || 'Not logged in',
      userId: user?.id,
      projectCount: count || 0,
      sceneCount: scenes?.length || 0,
      imageCount: images?.length || 0,
      projects: projects || [],
      error: error?.message,
    });
  } catch (err) {
    console.error('Debug error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
