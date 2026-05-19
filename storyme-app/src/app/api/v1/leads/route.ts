import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { LeadService } from '@/lib/leads/leadService';
import { CreateLeadRequestSchema } from '@/lib/leads/schemas';

function newRequestId() {
  return `lead_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(request: NextRequest) {
  const requestId = newRequestId();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Request body must be valid JSON',
          request_id: requestId,
        },
      },
      { status: 400 }
    );
  }

  let input;
  try {
    input = CreateLeadRequestSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid lead submission',
            details: err.issues,
            request_id: requestId,
          },
        },
        { status: 400 }
      );
    }
    throw err;
  }

  try {
    const client = createServiceRoleClient();
    const service = new LeadService(client);
    const lead = await service.createLead(input);

    return NextResponse.json({
      success: true,
      data: { lead_id: lead.id },
    });
  } catch (err) {
    console.error('[POST /api/v1/leads] error', { requestId, err });
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to record submission',
          request_id: requestId,
        },
      },
      { status: 500 }
    );
  }
}
