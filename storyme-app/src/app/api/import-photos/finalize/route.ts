/**
 * API Route: Finalize Photo Import
 * POST /api/import-photos/finalize
 *
 * Creates a project from transformed photo illustrations.
 * Uploads images to Supabase storage and creates scenes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';
import { ProjectRepository } from '@/lib/repositories/project.repository';
import { SceneRepository } from '@/lib/repositories/scene.repository';

export const maxDuration = 120; // 2 minute timeout

// Note: For App Router, body size is handled via middleware or request streaming
// The default limit should be sufficient as images are uploaded to Supabase storage

interface PhotoPage {
  pageNumber: number;
  imageBase64: string; // Transformed illustration
  captionEnglish: string;
  captionChinese?: string;
  isScenePage: boolean;
  pageType: 'cover' | 'scene';
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

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

    // Handle request body parsing with better error handling
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid request body. The payload may be too large or malformed.' },
        { status: 400 }
      );
    }
    const { title, storyContext, pages, illustrationStyle } = body as {
      title: string;
      storyContext?: string;
      pages: PhotoPage[];
      illustrationStyle?: 'pixar' | 'classic';
    };

    // Validate inputs
    if (!title || !title.trim()) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No photos to import' },
        { status: 400 }
      );
    }

    // Filter to only valid pages with actual image data
    const validPages = pages.filter(p =>
      p.imageBase64 &&
      typeof p.imageBase64 === 'string' &&
      p.imageBase64.length > 100 // Minimum reasonable base64 length
    );

    if (validPages.length === 0) {
      return NextResponse.json(
        { error: 'No valid photos with image data to import' },
        { status: 400 }
      );
    }

    console.log(`📚 Creating photo storybook with ${validPages.length} valid scenes (of ${pages.length} submitted): "${title}"`);

    // Use validPages for the rest of the processing
    const pagesToProcess = validPages;
    if (storyContext) {
      console.log(`  Story context: ${storyContext.substring(0, 50)}...`);
    }

    // Initialize services
    const storageService = new StorageService(supabase);
    const projectRepo = new ProjectRepository(supabase);
    const sceneRepo = new SceneRepository(supabase);

    // 1. Create project with photo import tracking
    const project = await projectRepo.create({
      user_id: user.id,
      title: title.trim(),
      description: storyContext || 'Created from photos',
      status: 'completed',
      visibility: 'private',
      source_type: 'imported_photos',
      import_metadata: {
        story_context: storyContext,
        total_photos: pagesToProcess.length,
        illustration_style: illustrationStyle || 'pixar',
        model_used: 'gpt-image-1.5', // OpenAI for image transform, Gemini for captions
      },
    } as any);

    console.log(`  Created project: ${project.id}`);

    // 2. Upload cover image from first page
    // Store in same pattern as regular stories: {user_id}/covers/{timestamp}.png
    let coverImageUrl: string | null = null;
    const firstPage = pagesToProcess[0];
    if (firstPage) {
      try {
        const coverBuffer = Buffer.from(firstPage.imageBase64, 'base64');
        const coverFilename = `${Date.now()}.png`;
        const coverPath = `${user.id}/covers/${coverFilename}`;

        const { error: uploadError } = await supabase.storage
          .from('generated-images')
          .upload(coverPath, coverBuffer, {
            contentType: 'image/png',
            cacheControl: '31536000',
            upsert: false,
          });

        if (uploadError) {
          console.error(`  Cover upload error:`, uploadError);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('generated-images')
            .getPublicUrl(coverPath);
          coverImageUrl = publicUrl;
          console.log(`  Uploaded cover image: ${coverPath}`);
        }
      } catch (coverError) {
        console.error(`  Failed to upload cover image:`, coverError);
      }
    }

    // 3. Upload scene images and create scenes
    const scenePages = pagesToProcess.filter(p => p.isScenePage && p.captionEnglish);

    console.log(`  Total pages received: ${pagesToProcess.length}`);
    console.log(`  Scene pages to process: ${scenePages.length}`);

    for (let i = 0; i < scenePages.length; i++) {
      const page = scenePages[i];
      const sceneNumber = i + 1;
      console.log(`  Processing scene ${sceneNumber}/${scenePages.length}...`);

      try {
        // Upload image to Supabase storage
        const imageDataUrl = `data:image/png;base64,${page.imageBase64}`;
        const uploadResult = await storageService.uploadGeneratedImageFromBase64(
          project.id,
          `${sceneNumber}`,
          imageDataUrl
        );

        console.log(`    Uploaded image: ${uploadResult.filename}`);

        // Create scene record
        const scene = await sceneRepo.create({
          project_id: project.id,
          scene_number: sceneNumber,
          description: page.captionEnglish,
          caption: page.captionEnglish,
          caption_chinese: page.captionChinese,
          raw_description: page.captionEnglish,
        });

        console.log(`    Created scene: ${scene.id}`);

        // Create generated_image record
        const { error: imageError } = await supabase
          .from('generated_images')
          .insert({
            project_id: project.id,
            scene_id: scene.id,
            image_url: uploadResult.url,
            image_filename: uploadResult.filename,
            status: 'completed',
            model_used: 'gemini-2.5-flash-image',
          });

        if (imageError) {
          console.error(`    Failed to create image record for scene ${sceneNumber}:`, imageError);
        }

      } catch (pageError) {
        console.error(`  Error processing scene ${sceneNumber}:`, pageError);
        // Continue with other pages
      }
    }

    // 4. Update project with cover image
    if (coverImageUrl) {
      try {
        await projectRepo.update(project.id, {
          cover_image_url: coverImageUrl,
        });
        console.log(`  Set cover image: ${coverImageUrl}`);
      } catch (coverError) {
        console.error(`  Failed to set cover image:`, coverError);
        // Try direct update as fallback
        const { error: directError } = await supabase
          .from('projects')
          .update({ cover_image_url: coverImageUrl })
          .eq('id', project.id);
        if (directError) {
          console.error(`  Direct cover update also failed:`, directError);
        } else {
          console.log(`  Set cover image via direct update: ${coverImageUrl}`);
        }
      }
    } else {
      console.warn(`  No cover image URL to set (coverImageUrl is null)`);
    }

    const finalizationTime = (Date.now() - startTime) / 1000;
    console.log(`✓ Created photo storybook with ${scenePages.length} scenes in ${finalizationTime.toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      sceneCount: scenePages.length,
      finalizationTime,
    });

  } catch (error) {
    console.error('Photo finalization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create storybook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
