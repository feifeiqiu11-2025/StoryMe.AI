/**
 * API Route: Character Breakdown — Plan Phase
 * POST /api/characters/[id]/breakdown/plan
 *
 * Takes a natural-language instruction describing what elements to extract
 * from a character's animated_preview_url (e.g., "Fish, Bunny, Magic Items").
 * Uses Gemini vision to locate bounding boxes, crops each region server-side
 * with sharp (white-padded to square), uploads to Supabase storage, and
 * returns preview URLs for user review. No database rows inserted yet —
 * that happens in the finalize route after user confirms.
 *
 * Crop-only (no image regeneration): preserves the exact already-polished
 * animated style so kids still recognize their drawing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getCharacterById } from '@/lib/db/characters';
import { detectElementBoundingBoxes } from '@/lib/gemini-image-client';
import { logApiUsage } from '@/lib/utils/rate-limit';
import sharp from 'sharp';

export const maxDuration = 60; // crops + uploads can take 10-30s for many elements

const MAX_ELEMENTS = 8;
const MIN_BBOX_AREA_FRACTION = 0.02; // reject bboxes smaller than 2% of image
const OUTPUT_SIZE = 1024;

// Fractional margin applied to each side of Gemini's bbox before cropping.
// Gemini returns tight bboxes, so any minor inaccuracy (±10-20 px) clips limbs
// or wands. A small uniform expansion absorbs that error at the cost of a bit
// of surrounding whitespace. 0.10 = 10% of the longer edge on each side.
const BBOX_MARGIN_FRACTION = 0.10;

interface PlanRequest {
  instruction: string;
}

interface PlanItem {
  tempKey: string;
  name: string;
  previewUrl: string;
  bbox: [number, number, number, number]; // pixel coords in source image (y1,x1,y2,x2)
}

/** Convert Gemini normalized 0-1000 coords to pixel coords, clamped to image bounds. */
function normalizedToPixel(
  bbox: [number, number, number, number],
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number } | null {
  const [y1, x1, y2, x2] = bbox;
  const pxY1 = Math.max(0, Math.round((y1 / 1000) * imageHeight));
  const pxX1 = Math.max(0, Math.round((x1 / 1000) * imageWidth));
  const pxY2 = Math.min(imageHeight, Math.round((y2 / 1000) * imageHeight));
  const pxX2 = Math.min(imageWidth, Math.round((x2 / 1000) * imageWidth));

  const width = pxX2 - pxX1;
  const height = pxY2 - pxY1;

  if (width <= 0 || height <= 0) return null;

  return { left: pxX1, top: pxY1, width, height };
}

/**
 * Expand a pixel rect by a fraction of its longer edge on each side, clamped
 * to image bounds. Counters Gemini's tight bbox output which sometimes clips
 * limbs, wands, or flowing clothing by a few pixels.
 */
function expandRect(
  rect: { left: number; top: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
  marginFraction: number
): { left: number; top: number; width: number; height: number } {
  const margin = Math.round(Math.max(rect.width, rect.height) * marginFraction);
  const left = Math.max(0, rect.left - margin);
  const top = Math.max(0, rect.top - margin);
  const right = Math.min(imageWidth, rect.left + rect.width + margin);
  const bottom = Math.min(imageHeight, rect.top + rect.height + margin);
  return { left, top, width: right - left, height: bottom - top };
}

/** Slugify a name for the storage filename. */
function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'element';
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  const { id: characterId } = await params;
  // Step marker so the outer catch can classify which stage failed. Lets us return
  // structured error codes instead of always blaming "rate limited" (the old behavior
  // misled us for months — same false-positive disease as analyze-character).
  let step: 'fetch_preview' | 'sharp_prep' | 'bbox_detection' | 'unknown' = 'unknown';

  try {
    // Auth
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Load source character + ownership check
    const { data: sourceCharacter, error: loadErr } = await getCharacterById(supabase, characterId);
    if (loadErr || !sourceCharacter) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }
    if (sourceCharacter.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!sourceCharacter.animated_preview_url) {
      return NextResponse.json(
        { error: 'This character has no animated preview yet. Generate a preview first.' },
        { status: 400 }
      );
    }

    // Parse + validate instruction
    const body: PlanRequest = await request.json();
    const instruction = (body.instruction || '').trim();
    if (!instruction) {
      return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
    }
    if (instruction.length > 500) {
      return NextResponse.json({ error: 'instruction too long (max 500 chars)' }, { status: 400 });
    }

    console.log(`[Breakdown Plan] source=${characterId} user=${user.id} instruction="${instruction}" preview_url=${sourceCharacter.animated_preview_url}`);

    // Fetch the animated preview image as a buffer
    step = 'fetch_preview';
    const imageResponse = await fetch(sourceCharacter.animated_preview_url);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch source image: HTTP ${imageResponse.status}`);
    }
    const originalBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Apply EXIF rotation once so vision coords and crop coords align.
    step = 'sharp_prep';
    const rotatedBuffer = await sharp(originalBuffer).rotate().toBuffer();
    const metadata = await sharp(rotatedBuffer).metadata();
    const imageWidth = metadata.width ?? OUTPUT_SIZE;
    const imageHeight = metadata.height ?? OUTPUT_SIZE;
    console.log(`[Breakdown Plan] source image: ${originalBuffer.length} bytes, ${imageWidth}×${imageHeight}`);

    // Call Gemini for bboxes. Send the rotated buffer as JPEG (smaller, faster).
    const jpegForVision = await sharp(rotatedBuffer)
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    const base64 = jpegForVision.toString('base64');
    step = 'bbox_detection';
    const boxes = await detectElementBoundingBoxes(base64, 'image/jpeg', instruction);

    const withBboxes = boxes.filter((b) => b.bbox !== null).slice(0, MAX_ELEMENTS);
    console.log(`[Breakdown Plan] Gemini returned ${boxes.length} entries, ${withBboxes.length} with bboxes`);
    if (withBboxes.length === 0) {
      // Distinguish "model couldn't locate any of these elements" from real failures.
      // Return 200 (the modal already shows planMessage in this case) but include
      // a code so the client can log it for debugging.
      return NextResponse.json({
        items: [],
        message: "Couldn't find any of those elements in the drawing. Try more specific names?",
        code: 'BBOX_EMPTY',
      });
    }

    const imageArea = imageWidth * imageHeight;
    const minArea = imageArea * MIN_BBOX_AREA_FRACTION;
    const rejected: string[] = [];
    const items: PlanItem[] = [];

    for (const box of withBboxes) {
      if (!box.bbox) continue;

      const tightRect = normalizedToPixel(box.bbox, imageWidth, imageHeight);
      if (!tightRect) {
        rejected.push(`${box.name} (degenerate bbox)`);
        continue;
      }
      // Area check uses the tight rect so noise-level bboxes still get filtered.
      if (tightRect.width * tightRect.height < minArea) {
        rejected.push(`${box.name} (too small to extract)`);
        continue;
      }

      // Expand the bbox before cropping to avoid clipping limbs/wands/hats.
      const pixelRect = expandRect(tightRect, imageWidth, imageHeight, BBOX_MARGIN_FRACTION);

      // Crop the padded region from the rotated source
      const cropped = await sharp(rotatedBuffer)
        .extract(pixelRect)
        .toBuffer();

      // Pad to square with white background, then resize to OUTPUT_SIZE.
      const maxSide = Math.max(pixelRect.width, pixelRect.height);
      const padX = Math.floor((maxSide - pixelRect.width) / 2);
      const padY = Math.floor((maxSide - pixelRect.height) / 2);

      const squared = await sharp(cropped)
        .extend({
          top: padY,
          bottom: maxSide - pixelRect.height - padY,
          left: padX,
          right: maxSide - pixelRect.width - padX,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .jpeg({ quality: 90, mozjpeg: true })
        .toBuffer();

      // Upload to character-images bucket
      const filename = `breakdown-${characterId}-${Date.now()}-${slug(box.name)}.jpg`;
      const storagePath = `${user.id}/${filename}`;

      const { error: uploadErr } = await supabase.storage
        .from('character-images')
        .upload(storagePath, squared, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) {
        console.error(`[Breakdown Plan] Upload failed for ${box.name}:`, uploadErr.message);
        rejected.push(`${box.name} (upload failed)`);
        continue;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('character-images')
        .getPublicUrl(storagePath);

      items.push({
        tempKey: `${Date.now()}-${items.length}`,
        name: box.name,
        previewUrl: publicUrl,
        bbox: box.bbox,
      });
    }

    await logApiUsage({
      userId: user.id,
      endpoint: `/api/characters/${characterId}/breakdown/plan?elements=${items.length}`,
      method: 'POST',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
      imagesGenerated: 0,
    });

    return NextResponse.json({
      items,
      rejected: rejected.length > 0 ? rejected : undefined,
      sourceCharacter: { id: sourceCharacter.id, name: sourceCharacter.name },
    });
  } catch (error) {
    const errorClass = error instanceof Error ? error.constructor.name : typeof error;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[Breakdown Plan] Error at step=${step} [${errorClass}]:`, errorMessage);

    // Genuine 429 only. Bare 'quota' substring previously caught unrelated errors
    // (e.g. "API key not valid for this quota project") and mistreated them as
    // throttling — that's why users saw "rate limited" for non-rate-limit failures.
    const isRateLimit = errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED');
    if (isRateLimit) {
      return NextResponse.json(
        {
          error: 'Image analysis is rate-limited right now. Please try again in a minute.',
          code: 'RATE_LIMITED',
          retryable: true,
        },
        { status: 429 }
      );
    }

    // Classify by which step failed.
    if (step === 'fetch_preview') {
      return NextResponse.json(
        {
          error: "Couldn't load the character's preview image.",
          code: 'FETCH_PREVIEW_FAILED',
          details: errorMessage,
        },
        { status: 502 }
      );
    }
    if (step === 'sharp_prep') {
      return NextResponse.json(
        {
          error: "Couldn't process the preview image. Please try regenerating the character preview first.",
          code: 'SHARP_FAILED',
          details: errorMessage,
        },
        { status: 422 }
      );
    }
    if (step === 'bbox_detection') {
      // Includes JSON parse failures and SDK errors that bubble out of detectElementBoundingBoxes.
      return NextResponse.json(
        {
          error: "Couldn't analyze the drawing for those elements. Try more specific names.",
          code: 'BBOX_DETECTION_FAILED',
          details: errorMessage,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to plan breakdown', code: 'BREAKDOWN_FAILED', details: errorMessage },
      { status: 500 }
    );
  }
}
