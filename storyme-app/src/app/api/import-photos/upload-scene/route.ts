/**
 * API Route: Upload Single Scene
 * POST /api/import-photos/upload-scene
 *
 * Uploads a single scene image (step 2 of chunked upload)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';
import { SceneRepository } from '@/lib/repositories/scene.repository';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { projectId, sceneNumber, imageBase64, captionEnglish, captionChinese, isCover } = body as {
      projectId: string;
      sceneNumber: number;
      imageBase64: string;
      captionEnglish: string;
      captionChinese?: string;
      isCover?: boolean;
    };

    // Validate inputs
    if (!projectId || !imageBase64) {
      return NextResponse.json(
        { error: 'Project ID and image are required' },
        { status: 400 }
      );
    }

    console.log(`  Uploading scene ${sceneNumber} for project ${projectId}...`);

    // Initialize services
    const storageService = new StorageService(supabase);
    const sceneRepo = new SceneRepository(supabase);

    // Upload image to Supabase storage
    const imageDataUrl = `data:image/png;base64,${imageBase64}`;
    const uploadResult = await storageService.uploadGeneratedImageFromBase64(
      projectId,
      `${sceneNumber}`,
      imageDataUrl
    );

    console.log(`    Uploaded image: ${uploadResult.filename}`);

    // Create scene record
    const scene = await sceneRepo.create({
      project_id: projectId,
      scene_number: sceneNumber,
      description: captionEnglish,
      caption: captionEnglish,
      caption_chinese: captionChinese,
      raw_description: captionEnglish,
    });

    console.log(`    Created scene: ${scene.id}`);

    // Create generated_image record
    const { error: imageError } = await supabase
      .from('generated_images')
      .insert({
        project_id: projectId,
        scene_id: scene.id,
        image_url: uploadResult.url,
        image_filename: uploadResult.filename,
        status: 'completed',
        model_used: 'gpt-image-1',
      });

    if (imageError) {
      console.error(`    Failed to create image record:`, imageError);
    }

    // If this is the cover, also upload as cover image
    if (isCover) {
      try {
        const coverBuffer = Buffer.from(imageBase64, 'base64');
        const coverFilename = `${Date.now()}.png`;
        const coverPath = `${user.id}/covers/${coverFilename}`;

        const { error: uploadError } = await supabase.storage
          .from('generated-images')
          .upload(coverPath, coverBuffer, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: false,
          });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage
            .from('generated-images')
            .getPublicUrl(coverPath);

          // Update project with cover image
          await supabase
            .from('projects')
            .update({ cover_image_url: publicUrl })
            .eq('id', projectId);

          console.log(`    Set cover image: ${coverPath}`);
        }
      } catch (coverError) {
        console.error(`    Failed to set cover image:`, coverError);
      }
    }

    return NextResponse.json({
      success: true,
      sceneId: scene.id,
      imageUrl: uploadResult.url,
    });

  } catch (error) {
    console.error('Upload scene error:', error);
    return NextResponse.json(
      {
        error: 'Failed to upload scene',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
