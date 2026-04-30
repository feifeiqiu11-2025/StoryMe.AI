import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StorageService } from '@/lib/services/storage.service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type - must be image
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      );
    }

    // Character uploads now run through a client-side canvas re-encode that always
    // outputs JPEG, so HEIC/PNG/WebP/etc. arriving here have already been normalized.
    // We still block formats that canvas itself can't decode reliably across browsers.
    const supportedFormats = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif'];
    if (!supportedFormats.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Unsupported image format: ${file.type}. Please upload JPG, PNG, HEIC, GIF, or WebP images.`,
          supportedFormats: ['JPEG', 'PNG', 'HEIC', 'GIF', 'WebP']
        },
        { status: 400 }
      );
    }

    // Block formats canvas can't reliably decode (AVIF varies by browser; BMP/TIFF/SVG rare).
    const fileName = file.name.toLowerCase();
    const unsupportedExtensions = ['.avif', '.bmp', '.tiff', '.tif', '.svg'];
    const hasUnsupportedExt = unsupportedExtensions.some(ext => fileName.endsWith(ext));
    if (hasUnsupportedExt) {
      const ext = unsupportedExtensions.find(ext => fileName.endsWith(ext)) || 'unknown';
      return NextResponse.json(
        {
          error: `Unsupported image format (${ext}). Please upload JPG, PNG, HEIC, GIF, or WebP images.`,
          supportedFormats: ['JPEG', 'PNG', 'HEIC', 'GIF', 'WebP']
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    // Get user (authenticated or guest)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Use user ID if authenticated, otherwise use 'guest' folder
    const userId = user?.id || 'guest';

    // Upload to Supabase Storage
    const storageService = new StorageService(supabase);
    const result = await storageService.uploadCharacterImage(userId, file);

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
      path: result.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
