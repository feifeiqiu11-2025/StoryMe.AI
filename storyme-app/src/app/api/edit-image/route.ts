/**
 * Edit Image API Endpoint
 *
 * Unified endpoint for editing both scene images and cover images.
 * Uses Gemini for text-guided image editing (primary), with Segmind as fallback.
 *
 * POST /api/edit-image
 *
 * Request Body:
 *   - imageUrl: string (current image URL from Supabase)
 *   - instruction: string (what to change, e.g., "remove the cat")
 *   - imageType: 'scene' | 'cover'
 *   - imageId: string (sceneId for scenes, or 'cover' for cover image)
 *   - illustrationStyle?: 'pixar' | 'classic' (optional, defaults to 'pixar')
 *   - sceneDescription?: string (optional, helps maintain context)
 *   - useProvider?: 'gemini' | 'segmind' (optional, defaults to 'gemini')
 *
 * Response:
 *   - success: boolean
 *   - imageUrl: string (new Supabase URL after upload)
 *   - editInstruction: string (stored for reference)
 *   - generationTime: number
 *   - provider: 'gemini' | 'segmind' (which provider was used)
 *   - error?: string (if failed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { editImageWithGemini, isGeminiEditAvailable } from '@/lib/gemini-image-client';
import { editImageWithQwen, isQwenAvailable } from '@/lib/qwen-image-client';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 300; // 5 minutes timeout for Vercel

type ImageProvider = 'gemini' | 'segmind';

interface EditImageRequest {
  imageUrl: string;
  instruction: string;
  imageType: 'scene' | 'cover';
  imageId: string;
  illustrationStyle?: 'pixar' | 'classic' | 'coloring';
  sceneDescription?: string;
  useProvider?: ImageProvider;
}

export async function POST(request: NextRequest) {
  const requestId = `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  try {
    const body: EditImageRequest = await request.json();
    const {
      imageUrl,
      instruction,
      imageType,
      imageId,
      illustrationStyle = 'pixar',
      sceneDescription,
      useProvider,
    } = body;

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

    console.log(`[Edit Image] ${requestId} - Type: ${imageType}, ID: ${imageId}`);
    console.log(`[Edit Image] Instruction: "${instruction}"`);
    console.log(`[Edit Image] Style: ${illustrationStyle}, Provider preference: ${useProvider || 'auto'}`);

    // Determine which provider to use
    // Priority: explicit preference > Gemini (if available) > Segmind (fallback)
    let provider: ImageProvider;
    if (useProvider === 'segmind' && isQwenAvailable()) {
      provider = 'segmind';
    } else if (isGeminiEditAvailable()) {
      provider = 'gemini';
    } else if (isQwenAvailable()) {
      provider = 'segmind';
    } else {
      return NextResponse.json(
        { success: false, error: 'Image editing is not configured. Please contact support.' },
        { status: 503 }
      );
    }

    console.log(`[Edit Image] Using provider: ${provider}`);

    // Call the appropriate provider
    let resultImageUrl: string;
    let generationTime: number;

    if (provider === 'gemini') {
      // Use Gemini for text-guided image editing
      const result = await editImageWithGemini({
        currentImageUrl: imageUrl,
        editInstruction: instruction.trim(),
        sceneDescription,
        illustrationStyle,
      });
      resultImageUrl = result.imageUrl;
      generationTime = result.generationTime;
    } else {
      // Use Segmind/Qwen as fallback
      const result = await editImageWithQwen(imageUrl, instruction.trim());
      resultImageUrl = result.imageUrl;
      generationTime = result.generationTime;
    }

    console.log(`[Edit Image] ${provider} returned image in ${generationTime.toFixed(1)}s`);

    // Upload the edited image to Supabase Storage
    const supabase = await createClient();

    // Get user (authenticated or guest)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'guest';

    // Convert base64 data URL to buffer
    let imageBuffer: Buffer;
    if (resultImageUrl.startsWith('data:')) {
      const base64Data = resultImageUrl.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else {
      // Fallback: fetch from URL
      const imageResponse = await fetch(resultImageUrl);
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
        imageUrl: resultImageUrl, // Base64 data URL
        editInstruction: instruction,
        generationTime,
        provider,
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
      generationTime,
      provider,
    });

  } catch (error) {
    console.error(`[Edit Image] ${requestId} Error:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Provide user-friendly error messages
    let userMessage = 'Failed to edit image. Please try again.';
    if (errorMessage.includes('rate') || errorMessage.includes('429')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (errorMessage.includes('GEMINI_API_KEY') || errorMessage.includes('SEGMIND_API_KEY')) {
      userMessage = 'Image editing is not configured.';
    } else if (errorMessage.includes('Failed to fetch current image')) {
      userMessage = 'Could not access the image. Please try again.';
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
