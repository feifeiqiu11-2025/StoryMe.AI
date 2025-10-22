/**
 * API Route: Publish Story to KindleWood Kids App
 * POST /api/projects/[id]/publish-kids-app
 *
 * Publishes a story to KindleWood Kids App for selected children
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/projects/[id]/publish-kids-app
 * Publish a story to KindleWood Kids App for selected children
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get request body
    const body = await request.json();
    const { childProfileIds, category = 'bedtime' } = body;

    if (!childProfileIds || !Array.isArray(childProfileIds) || childProfileIds.length === 0) {
      return NextResponse.json(
        { error: 'childProfileIds array is required' },
        { status: 400 }
      );
    }

    // 3. Verify project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, title, coverImageUrl, description')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // 4. Verify all child profiles belong to user
    const { data: profiles, error: profilesError } = await supabase
      .from('child_profiles')
      .select('id, name')
      .in('id', childProfileIds)
      .eq('parent_user_id', user.id);

    if (profilesError || !profiles || profiles.length !== childProfileIds.length) {
      return NextResponse.json(
        { error: 'Invalid child profile IDs' },
        { status: 400 }
      );
    }

    // 5. Validate project has all required content
    const { data: scenes, error: scenesError } = await supabase
      .from('scenes')
      .select('id, scene_number')
      .eq('project_id', projectId)
      .order('scene_number', { ascending: true });

    if (scenesError || !scenes || scenes.length === 0) {
      return NextResponse.json(
        { error: 'Project has no scenes' },
        { status: 400 }
      );
    }

    const sceneIds = scenes.map(s => s.id);

    // 6. Verify all scenes have images
    const { data: images, error: imagesError } = await supabase
      .from('generated_images')
      .select('scene_id')
      .in('scene_id', sceneIds);

    if (imagesError) {
      return NextResponse.json({ error: 'Error checking images' }, { status: 500 });
    }

    const scenesWithImages = new Set(images?.map(i => i.scene_id) || []);
    const missingImages = scenes.filter(s => !scenesWithImages.has(s.id));

    if (missingImages.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing images',
          missingScenes: missingImages.map(s => s.scene_number),
          message: `Please generate images for scene(s): ${missingImages.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 7. Verify all scenes have audio
    const { data: audioFiles, error: audioError } = await supabase
      .from('story_audio_pages')
      .select('scene_id')
      .in('scene_id', sceneIds)
      .not('audio_url', 'is', null);

    if (audioError) {
      return NextResponse.json({ error: 'Error checking audio' }, { status: 500 });
    }

    const scenesWithAudio = new Set(audioFiles?.map(a => a.scene_id) || []);
    const missingAudio = scenes.filter(s => !scenesWithAudio.has(s.id));

    if (missingAudio.length > 0) {
      return NextResponse.json(
        {
          error: 'Some scenes are missing audio',
          missingScenes: missingAudio.map(s => s.scene_number),
          message: `Please generate audio for scene(s): ${missingAudio.map(s => s.scene_number).join(', ')}`
        },
        { status: 400 }
      );
    }

    // 8. Create or update publication record
    const { data: publication, error: pubError } = await supabase
      .from('publications')
      .upsert({
        project_id: projectId,
        user_id: user.id,
        platform: 'kindlewood_app',
        title: project.title,
        author: user.email || 'Unknown',
        description: project.description,
        cover_image_url: project.coverImageUrl,
        guid: `kindlewood-app-${projectId}`,
        status: 'live',
        published_at: new Date().toISOString(),
        live_at: new Date().toISOString(),
        platform_metadata: {
          category: category,
          language: 'en',
          child_count: childProfileIds.length,
          scene_count: scenes.length,
        },
      }, {
        onConflict: 'project_id,platform',
      })
      .select()
      .single();

    if (pubError) {
      console.error('Error creating publication:', pubError);
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    // 9. Add publication targets for each child
    const targets = childProfileIds.map((childId: string) => ({
      publication_id: publication.id,
      target_type: 'child_profile',
      target_id: childId,
      is_active: true,
      target_metadata: {
        category: category,
      },
    }));

    const { data: insertedTargets, error: targetsError } = await supabase
      .from('publication_targets')
      .upsert(targets, {
        onConflict: 'publication_id,target_id',
      })
      .select();

    if (targetsError) {
      console.error('Error creating publication targets:', targetsError);
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // 10. Return success response
    return NextResponse.json({
      success: true,
      publication,
      targets: insertedTargets,
      publishedTo: profiles.map(p => p.name),
      message: `"${project.title}" published to ${insertedTargets?.length || 0} child profile(s): ${profiles.map(p => p.name).join(', ')}`,
    });

  } catch (error: any) {
    console.error('Error publishing to Kids App:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/projects/[id]/publish-kids-app
 * Check if a story is published to Kids App and get details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get publication record with targets
    const { data: publication, error } = await supabase
      .from('publications')
      .select(`
        *,
        publication_targets!inner(
          id,
          target_id,
          is_active,
          added_at
        )
      `)
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error)
      console.error('Error fetching publication:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!publication) {
      return NextResponse.json({
        isPublished: false,
        status: 'not_published',
        publishedTo: [],
      });
    }

    // Get child profile names
    const targetIds = publication.publication_targets
      .filter((t: any) => t.is_active)
      .map((t: any) => t.target_id);

    let childProfiles: any[] = [];
    if (targetIds.length > 0) {
      const { data: profiles } = await supabase
        .from('child_profiles')
        .select('id, name')
        .in('id', targetIds);
      childProfiles = profiles || [];
    }

    const activeTargets = publication.publication_targets.filter((t: any) => t.is_active);

    return NextResponse.json({
      isPublished: publication.status === 'live' && activeTargets.length > 0,
      status: publication.status,
      publishedAt: publication.published_at,
      publishedTo: activeTargets.map((t: any) => {
        const profile = childProfiles.find(p => p.id === t.target_id);
        return {
          childId: t.target_id,
          childName: profile?.name || 'Unknown',
          publishedAt: t.added_at,
        };
      }),
      publication,
    });

  } catch (error: any) {
    console.error('Error checking publish status:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/publish-kids-app
 * Unpublish a story from Kids App
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Get publication
    const { data: publication } = await supabase
      .from('publications')
      .select('id')
      .eq('project_id', projectId)
      .eq('platform', 'kindlewood_app')
      .single();

    if (!publication) {
      return NextResponse.json(
        { error: 'Publication not found' },
        { status: 404 }
      );
    }

    // Soft delete - set is_active to false for all targets
    const { error: targetsError } = await supabase
      .from('publication_targets')
      .update({
        is_active: false,
        removed_at: new Date().toISOString(),
      })
      .eq('publication_id', publication.id);

    if (targetsError) {
      return NextResponse.json({ error: targetsError.message }, { status: 500 });
    }

    // Update publication status
    const { error: pubError } = await supabase
      .from('publications')
      .update({
        status: 'unpublished',
        unpublished_at: new Date().toISOString(),
      })
      .eq('id', publication.id);

    if (pubError) {
      return NextResponse.json({ error: pubError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Story unpublished from Kids App',
    });

  } catch (error: any) {
    console.error('Error unpublishing:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
