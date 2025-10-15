import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

export async function GET() {
  const supabase = createServiceRoleClient();

  // Test direct query
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      title,
      scenes (
        id,
        scene_number,
        images:generated_images (
          id,
          image_url,
          status
        )
      )
    `)
    .eq('status', 'completed')
    .limit(1)
    .single();

  return NextResponse.json({
    error: error?.message,
    data,
  });
}
