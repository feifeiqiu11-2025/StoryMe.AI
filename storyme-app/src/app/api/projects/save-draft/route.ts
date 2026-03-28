/**
 * API Route: Save Story as Draft
 * POST /api/projects/save-draft
 *
 * Saves or updates a draft story. Drafts:
 * - Don't count toward subscription limits
 * - Are always private (visibility forced to 'private')
 * - Don't trigger audio generation
 * - Can be resumed later from the create page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ProjectService } from '@/lib/services/project.service';

// Max JSONB size: 500KB to prevent abuse
const MAX_METADATA_SIZE = 500 * 1024;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const {
      projectId,        // Optional: update existing draft
      title,
      description,
      authorName,
      authorAge,
      coverImageUrl,
      originalScript,
      readingLevel,
      storyTone,
      language = 'en',
      secondaryLanguage = null,
      characterIds,
      scenes,
      draftMetadata,
    } = body;

    // Validate: must have at least something to save
    const hasCharacters = characterIds && Array.isArray(characterIds) && characterIds.length > 0;
    const hasScript = originalScript && typeof originalScript === 'string' && originalScript.trim().length > 0;
    const hasScenes = scenes && Array.isArray(scenes) && scenes.length > 0;

    if (!hasCharacters && !hasScript && !hasScenes) {
      return NextResponse.json(
        { error: 'Draft must have at least characters, a script, or scenes' },
        { status: 400 }
      );
    }

    // Validate draft_metadata size
    if (draftMetadata) {
      const metadataSize = JSON.stringify(draftMetadata).length;
      if (metadataSize > MAX_METADATA_SIZE) {
        return NextResponse.json(
          { error: `Draft metadata too large (${Math.round(metadataSize / 1024)}KB). Maximum is ${MAX_METADATA_SIZE / 1024}KB.` },
          { status: 400 }
        );
      }
    }

    // Validate projectId is for a draft if provided
    if (projectId) {
      const { data: existingProject } = await supabase
        .from('projects')
        .select('id, status, user_id')
        .eq('id', projectId)
        .single();

      if (!existingProject) {
        return NextResponse.json(
          { error: 'Draft project not found' },
          { status: 404 }
        );
      }

      if (existingProject.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized: Draft does not belong to you' },
          { status: 403 }
        );
      }

      if (existingProject.status !== 'draft') {
        return NextResponse.json(
          { error: 'Cannot update a non-draft project. Only drafts can be updated via this endpoint.' },
          { status: 400 }
        );
      }
    }

    // Save draft via service layer
    const projectService = new ProjectService(supabase);
    const result = await projectService.saveDraft(user.id, {
      projectId,
      title,
      description,
      authorName,
      authorAge: authorAge ? parseInt(String(authorAge), 10) : undefined,
      coverImageUrl,
      originalScript,
      readingLevel,
      storyTone,
      language: language as 'en' | 'zh',
      secondaryLanguage,
      characterIds,
      scenes,
      draftMetadata: {
        ...draftMetadata,
        savedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      project: result.project,
      message: projectId ? 'Draft updated successfully' : 'Draft saved successfully',
    });

  } catch (error) {
    console.error('Error saving draft:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}
