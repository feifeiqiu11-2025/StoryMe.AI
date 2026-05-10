/**
 * API Route: POST /api/v1/editor/upload-image
 *
 * Reusable image-upload endpoint for the chapter book editor (and any
 * future editor). Receives a multipart form with a single `file`, runs
 * sharp compression (resize → WebP), uploads to Supabase Storage under
 * the user's namespace, returns a public URL.
 *
 * Principle 1 (Security): auth gate, MIME allowlist, 10 MB hard cap,
 *   sharp re-encode strips EXIF and rejects malformed payloads.
 * Principle 5 (Reuse): wraps the existing Supabase Storage bucket; no
 *   new bucket creation, no new ACLs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { compressImage } from '@/lib/services/imageProcessing.service';
import { randomUUID } from 'crypto';

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);
const BUCKET = 'generated-images'; // Reuse existing bucket — public-read, RLS-friendly.

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'Image is too large. Please pick one under 10 MB.' },
        { status: 413 }
      );
    }
    if (!ALLOWED_MIME.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported image type: ${file.type}` },
        { status: 415 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());
    let compressed;
    try {
      compressed = await compressImage(inputBuffer);
    } catch (err) {
      console.error('Image compression failed:', err);
      return NextResponse.json(
        { error: 'Could not process this image.' },
        { status: 422 }
      );
    }

    // Use service role for the storage write so we don't need a per-user
    // RLS policy on this bucket — same pattern as sticker generation.
    const serviceClient = createServiceRoleClient();
    const filename = `${randomUUID()}.webp`;
    const path = `editor/${user.id}/${filename}`;

    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, compressed.buffer, {
        contentType: compressed.contentType,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      return NextResponse.json(
        { error: 'Failed to save the image.' },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      image: {
        url: publicUrl,
        width: compressed.width,
        height: compressed.height,
        bytes: compressed.bytes,
      },
    });
  } catch (error) {
    console.error('upload-image route error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}
