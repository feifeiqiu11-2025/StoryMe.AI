/**
 * Edit Image API Endpoint
 *
 * Unified endpoint for editing both scene images and cover images using Qwen-Image-Edit.
 * Takes the current image URL and a natural language instruction, returns the edited image.
 *
 * POST /api/edit-image
 *
 * Request Body:
 *   - imageUrl: string (current image URL from Supabase)
 *   - instruction: string (what to change, e.g., "remove the cat")
 *   - imageType: 'scene' | 'cover'
 *   - imageId: string (sceneId for scenes, or 'cover' for cover image)
 *
 * Response:
 *   - success: boolean
 *   - imageUrl: string (new Supabase URL after upload)
 *   - editInstruction: string (stored for reference)
 *   - generationTime: number
 *   - error?: string (if failed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { editImageWithQwen, isQwenAvailable } from '@/lib/qwen-image-client';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes timeout for Vercel

export async function POST(request: NextRequest) {
  const requestId = `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    const body = await request.json();
    const { imageUrl, instruction, imageType, imageId } = body;

    // Validate inputs
    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Image URL is required' },
        { status: 400 }
      );
    }

    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Please provide a clear instruction (at least 3 characters)' },
        { status: 400 }
      );
    }

    if (!imageType || !['scene', 'cover'].includes(imageType)) {
      return NextResponse.json(
        { success: false, error: 'Invalid image type. Must be "scene" or "cover"' },
        { status: 400 }
      );
    }

    if (!imageId) {
      return NextResponse.json(
        { success: false, error: 'Image ID is required' },
        { status: 400 }
      );
    }

    // Check if Qwen is available
    if (!isQwenAvailable()) {
      return NextResponse.json(
        { success: false, error: 'Image editing is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    console.log(`[Edit Image] ${requestId} - Type: ${imageType}, ID: ${imageId}`);
    console.log(`[Edit Image] Instruction: "${instruction}"`);

    // Call Qwen to edit the image
    const result = await editImageWithQwen(imageUrl, instruction.trim());

    console.log(`[Edit Image] Qwen returned image in ${result.generationTime}s`);

    // Upload the edited image to Supabase Storage
    const supabase = await createClient();

    // Get user (authenticated or guest)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'guest';

    // Convert base64 data URL to buffer
    let imageBuffer: Buffer;
    if (result.imageUrl.startsWith('data:')) {
      const base64Data = result.imageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Fallback: fetch from URL
      const imageResponse = await fetch(result.imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch edited image: ${imageResponse.statusText}`);
      }
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    }

    // Generate unique filename
    const timestamp = Date.now();
    const folder = imageType === 'cover' ? 'covers' : 'scenes';
    const fileName = `${userId}/${folder}/edited-${imageId}-${timestamp}.png`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(fileName, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error(`[Edit Image] Upload error:`, uploadError);
      // Return the base64 image as fallback
      console.log(`[Edit Image] Returning base64 image as fallback`);
      return NextResponse.json({
        success: true,
        imageUrl: result.imageUrl, // Base64 data URL
        editInstruction: instruction,
        generationTime: result.generationTime,
        uploadFailed: true,
      });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('generated-images')
      .getPublicUrl(fileName);

    const finalImageUrl = urlData.publicUrl;
    console.log(`[Edit Image] Uploaded to: ${finalImageUrl}`);

    return NextResponse.json({
      success: true,
      imageUrl: finalImageUrl,
      editInstruction: instruction,
      generationTime: result.generationTime,
    });

  } catch (error) {
    console.error(`[Edit Image] ${requestId} Error:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages
    let userMessage = 'Failed to edit image. Please try again.';
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (errorMessage.includes('DASHSCOPE_API_KEY')) {
      userMessage = 'Image editing is not configured.';
    }

    return NextResponse.json(
      {
        success: false,
        error: userMessage,
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
