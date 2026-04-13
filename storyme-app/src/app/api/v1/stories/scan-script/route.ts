/**
 * API Route: Scan Handwritten Script
 * POST /api/v1/stories/scan-script
 *
 * Accepts an uploaded image of handwritten story scenes and uses
 * Gemini Vision to extract and digitize the text.
 *
 * Principle 1 (Security): Auth required, file validation, EXIF stripped via re-encoding
 * Principle 2 (API Contract): Validated request/response, versioned endpoint
 * Principle 6 (Separation): Delegates to scan-script service
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { scanScriptFromImage } from '@/lib/services/scan-script.service';

export const maxDuration = 30; // 30 seconds timeout

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    // Principle 1 (Security): Authenticate user
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            request_id: requestId,
          },
        },
        { status: 401 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('image') as File | null;
    const mode = (formData.get('mode') as string) || 'freeform';
    const languageHint = formData.get('language') as string | null;

    // Validate file exists
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Image file is required',
            request_id: requestId,
          },
        },
        { status: 400 }
      );
    }

    // Validate mode
    if (mode !== 'freeform' && mode !== 'worksheet') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Mode must be "freeform" or "worksheet"',
            request_id: requestId,
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
            request_id: requestId,
          },
        },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, WebP, HEIC`,
            request_id: requestId,
          },
        },
        { status: 400 }
      );
    }

    console.log(`[ScanScript] ${requestId} | user=${user.id} | mode=${mode} | type=${file.type} | size=${(file.size / 1024).toFixed(0)}KB`);

    // Convert file to base64 (Principle 1: process in memory, don't store)
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    // Call service layer (Principle 6: delegate to service)
    const result = await scanScriptFromImage(
      base64,
      file.type,
      mode as 'freeform' | 'worksheet',
      languageHint || undefined
    );

    console.log(`[ScanScript] ${requestId} | confidence=${result.confidence} | scenes=${result.scenes.length} | lang=${result.detectedLanguage || 'unknown'}`);

    return NextResponse.json({
      success: true,
      data: result,
      request_id: requestId,
    });

  } catch (error) {
    console.error(`[ScanScript] ${requestId} | Error:`, error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to scan script from image',
          details: message,
          request_id: requestId,
        },
      },
      { status: 500 }
    );
  }
}
