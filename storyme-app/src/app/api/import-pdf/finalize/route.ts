/**
 * API Route: Finalize PDF Import
 * POST /api/import-pdf/finalize
 *
 * Creates a project from imported PDF content.
 * Uploads images to Supabase storage and creates scenes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';
import { ProjectRepository } from '@/lib/repositories/project.repository';
import { SceneRepository } from '@/lib/repositories/scene.repository';

export const maxDuration = 120; // 2 minute timeout for large PDFs

interface ImportedPage {
  pageNumber: number;
  imageBase64: string;
  captionEnglish: string;
  captionChinese?: string;
  isScenePage: boolean;
  pageType: 'cover' | 'scene' | 'credits' | 'other';
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

    const body = await request.json();
    const { title, pages, originalFilename } = body as {
      title: string;
      pages: ImportedPage[];
      originalFilename?: string;
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
        { error: 'No pages to import' },
        { status: 400 }
      );
    }

    console.log(`📚 Creating project from ${pages.length} imported pages: "${title}"`);

    // Initialize services
    const storageService = new StorageService(supabase);
    const projectRepo = new ProjectRepository(supabase);
    const sceneRepo = new SceneRepository(supabase);

    // 1. Create project with import tracking
    const project = await projectRepo.create({
      user_id: user.id,
      title: title.trim(),
      description: 'Imported from PDF',
      status: 'completed', // PDF import creates completed project
      visibility: 'private',
      source_type: 'imported_pdf',
      import_metadata: {
        original_filename: originalFilename,
        total_pages: pages.length,
        gemini_model_used: 'gemini-2.0-flash',
      },
    } as any); // Cast to any since these fields may not be in type yet

    console.log(`  Created project: ${project.id}`);

    // 2. Upload cover image from page 1 (always use first page as cover)
    // Store in same pattern as regular stories: {user_id}/covers/{timestamp}.png
    let coverImageUrl: string | null = null;
    const firstPage = pages.find(p => p.pageNumber === 1);
    if (firstPage) {
      try {
        const coverBuffer = Buffer.from(firstPage.imageBase64, 'base64');
        const coverFilename = `${Date.now()}.png`;
        const coverPath = `${user.id}/covers/${coverFilename}`;

        const { data: coverData, error: uploadError } = await supabase.storage
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
    // Filter to only scene pages with captions (English OR Chinese)
    // Supports bilingual PDFs where some pages may only have Chinese captions
    const scenePages = pages.filter(p => p.isScenePage && (p.captionEnglish || p.captionChinese));

    // Log page details for debugging
    console.log(`  Total pages received: ${pages.length}`);
    console.log(`  Pages with isScenePage=true: ${pages.filter(p => p.isScenePage).length}`);
    console.log(`  Pages with captionEnglish: ${pages.filter(p => p.captionEnglish).length}`);
    console.log(`  Pages with captionChinese: ${pages.filter(p => p.captionChinese).length}`);
    console.log(`  Scene pages to process: ${scenePages.length}`);

    if (scenePages.length > 0) {
      const firstCaption = scenePages[0].captionEnglish || scenePages[0].captionChinese || '';
      console.log(`  First scene: page ${scenePages[0].pageNumber}, type: ${scenePages[0].pageType}, caption: "${firstCaption.substring(0, 50)}..."`);
    }

    for (let i = 0; i < scenePages.length; i++) {
      const page = scenePages[i];
      const sceneNumber = i + 1; // Sequential scene number starting from 1
      console.log(`  Processing scene ${sceneNumber}/${scenePages.length} (original page ${page.pageNumber})...`);

      try {
        // Upload image to Supabase storage
        const imageDataUrl = `data:image/png;base64,${page.imageBase64}`;
        const uploadResult = await storageService.uploadGeneratedImageFromBase64(
          project.id,
          `${sceneNumber}`,  // Just the number - StorageService adds "scene-" prefix
          imageDataUrl
        );

        console.log(`    Uploaded image: ${uploadResult.filename}`);

        // Create scene record first to get scene ID
        // Use English caption if available, otherwise fall back to Chinese for description
        const primaryCaption = page.captionEnglish || page.captionChinese || '';
        const scene = await sceneRepo.create({
          project_id: project.id,
          scene_number: sceneNumber,
          description: primaryCaption,
          caption: page.captionEnglish || '',
          caption_chinese: page.captionChinese,
          raw_description: primaryCaption,
        });

        console.log(`    Created scene: ${scene.id}`);

        // Create generated_image record with the scene ID
        const { data: imageData, error: imageError } = await supabase
          .from('generated_images')
          .insert({
            project_id: project.id,
            scene_id: scene.id,
            image_url: uploadResult.url,
            image_filename: uploadResult.filename,
            status: 'completed',
            model_used: 'imported_pdf',
          })
          .select()
          .single();

        if (imageError) {
          console.error(`    Failed to create image record for scene ${sceneNumber}:`, imageError);
        } else {
          console.log(`    Created generated_image: ${imageData?.id}`);
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
    console.log(`✓ Created project with ${scenePages.length} scenes in ${finalizationTime.toFixed(1)}s`);

    return NextResponse.json({
      success: true,
      projectId: project.id,
      sceneCount: scenePages.length,
      finalizationTime,
    });

  } catch (error) {
    console.error('Finalization error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create storybook',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
