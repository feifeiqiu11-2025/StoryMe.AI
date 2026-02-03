/**
 * API Route: Generate Drawing Guide
 * POST /api/characters/sketch-guide
 *
 * Generates a step-by-step drawing guide for kids to learn how to draw characters.
 *
 * Principle 1 (Security): Requires authentication, validates input with Zod
 * Principle 2 (API Contracts): Clear request/response schemas with error handling
 * Principle 7 (Stateless): Async job for long-running operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { generateSketchGuide, isSketchServiceAvailable } from '@/lib/gemini-sketch-service';

export const maxDuration = 60; // 60 seconds timeout (image generation can be slow)

// Request validation schema (Principle 2: Clear API Contracts)
const SketchGuideRequestSchema = z.object({
  character_name: z.string().min(1, 'Character name is required').max(100, 'Name too long'),
  character_type: z.string().min(1, 'Character type is required').max(200, 'Type too long'),
  additional_details: z.string().max(500, 'Details too long').optional(),
});

type SketchGuideRequest = z.infer<typeof SketchGuideRequestSchema>;

// Response schemas
const SketchGuideSuccessSchema = z.object({
  success: z.literal(true),
  data: z.object({
    sketch_preview_url: z.string(),
    steps: z.array(z.object({
      step_number: z.number().int().min(1).max(6),
      title: z.string(),
      description: z.string(),
      image_url: z.string(),
    })).min(3).max(6),
    character_description: z.string(),
  }),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.enum([
      'UNAUTHORIZED',
      'VALIDATION_FAILED',
      'SERVICE_UNAVAILABLE',
      'GENERATION_FAILED',
      'INTERNAL_ERROR',
    ]),
    message: z.string(),
    details: z.any().optional(),
    request_id: z.string(),
  }),
});

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();

  try {
    // Principle 1 (Security): Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          request_id: requestId,
        },
      }, { status: 401 });
    }

    // Check if Gemini service is available
    if (!isSketchServiceAvailable()) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Drawing guide service is not configured. Please check GEMINI_API_KEY.',
          request_id: requestId,
        },
      }, { status: 503 });
    }

    // Principle 2 (API Contract): Validate request body
    const body = await request.json();
    const validation = SketchGuideRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid request data',
          details: validation.error.flatten().fieldErrors,
          request_id: requestId,
        },
      }, { status: 400 });
    }

    const input = validation.data;

    console.log(`[API] [${requestId}] Generating sketch guide for: ${input.character_name} (user: ${user.id})`);

    // TODO: Check rate limiting here (Principle 1: Security)
    // For now, rely on Gemini API rate limits

    // Generate the sketch guide
    const guide = await generateSketchGuide({
      character_name: input.character_name,
      character_type: input.character_type,
      additional_details: input.additional_details,
    });

    console.log(`[API] [${requestId}] Successfully generated ${guide.steps.length} steps`);

    // Optional: Track analytics event
    try {
      await supabase.from('events').insert({
        user_id: user.id,
        event_type: 'sketch_guide_generated',
        metadata: {
          character_type: input.character_type,
          step_count: guide.steps.length,
          request_id: requestId,
        },
      });
    } catch (analyticsError) {
      // Don't fail the request if analytics fails
      console.warn(`[API] [${requestId}] Failed to track analytics:`, analyticsError);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      data: {
        sketch_preview_url: guide.sketch_preview_url,
        steps: guide.steps,
        character_description: guide.character_description,
      },
    }, { status: 200 });

  } catch (error) {
    console.error(`[API] [${requestId}] Error generating sketch guide:`, error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Return error response
    return NextResponse.json({
      success: false,
      error: {
        code: 'GENERATION_FAILED',
        message: 'Failed to generate drawing guide',
        details: errorMessage,
        request_id: requestId,
      },
    }, { status: 500 });
  }
}
