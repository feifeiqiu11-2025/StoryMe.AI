// API Route: Generate Sketch Drawing Guide
// POST /api/characters/sketch-guide
// Following Principle 2: Clear API Contracts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { generateSketchGuide } from '@/lib/gemini-sketch-service';
import { nanoid } from 'nanoid';

// Request validation schema
const SketchGuideRequestSchema = z.object({
  character_name: z.string().min(1, 'Character name required').max(100),
  character_type: z.string().min(1, 'Character type required').max(200),
  additional_details: z.string().max(500).optional(),
});

// Response schemas
const SketchStepSchema = z.object({
  step_number: z.number(),
  title: z.string(),
  description: z.string(),
});

const SketchGuideResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    guide_image_url: z.string(),
    steps: z.array(SketchStepSchema),
    character_description: z.string(),
  }),
  request_id: z.string(),
});

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
    request_id: z.string(),
  }),
});

function createErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: any
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      details,
      request_id: requestId,
    },
  };
}

export async function POST(req: NextRequest) {
  const requestId = nanoid();

  try {
    // Principle 1: Security by Default - Authenticate
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        createErrorResponse('UNAUTHORIZED', 'Authentication required', requestId),
        { status: 401 }
      );
    }

    // Principle 2: Clear API Contracts - Validate request
    const body = await req.json();
    const validationResult = SketchGuideRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        createErrorResponse(
          'VALIDATION_FAILED',
          'Invalid request data',
          requestId,
          { errors: validationResult.error.format() }
        ),
        { status: 400 }
      );
    }

    const { character_name, character_type, additional_details } =
      validationResult.data;

    console.log(
      `[SketchGuide] User ${user.id} generating guide for "${character_name}"`
    );

    // Principle 5: Reuse Before Rebuild - Use existing Gemini service
    const sketchGuide = await generateSketchGuide({
      character_name,
      character_type,
      additional_details,
    });

    // Validate response
    const response = {
      success: true as const,
      data: sketchGuide,
      request_id: requestId,
    };

    const validatedResponse = SketchGuideResponseSchema.parse(response);

    console.log(
      `[SketchGuide] Successfully generated ${sketchGuide.steps.length} steps for "${character_name}"`
    );

    return NextResponse.json(validatedResponse, { status: 200 });
  } catch (error) {
    console.error('[SketchGuide] Error generating sketch guide:', error);

    // Determine error type and return appropriate response
    if (error instanceof Error) {
      if (error.message.includes('Gemini API is not configured')) {
        return NextResponse.json(
          createErrorResponse(
            'SERVICE_UNAVAILABLE',
            'Sketch generation service is not available',
            requestId
          ),
          { status: 503 }
        );
      }

      if (error.message.includes('GEMINI_API_KEY')) {
        return NextResponse.json(
          createErrorResponse(
            'CONFIGURATION_ERROR',
            'Service configuration error',
            requestId
          ),
          { status: 500 }
        );
      }

      if (error.message.includes('Failed to generate')) {
        return NextResponse.json(
          createErrorResponse(
            'GENERATION_FAILED',
            'Failed to generate sketch guide. Please try again.',
            requestId,
            { original_error: error.message }
          ),
          { status: 500 }
        );
      }
    }

    // Generic error
    return NextResponse.json(
      createErrorResponse(
        'INTERNAL_ERROR',
        error instanceof Error ? error.message : 'An unexpected error occurred',
        requestId
      ),
      { status: 500 }
    );
  }
}

// Set timeout to 60 seconds for AI generation
export const maxDuration = 60;
