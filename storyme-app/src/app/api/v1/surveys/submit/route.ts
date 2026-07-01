/**
 * API Route: POST /api/v1/surveys/submit
 *
 * Public endpoint — accepts an anonymous survey submission and stores it in the
 * generic `survey_responses` table (one row per submission, keyed by slug).
 *
 * Principle 1 (Security): public can submit, but only via this route. Writes use
 *   the service-role client so the table itself stays locked down by RLS. Inputs
 *   are validated and bounded; no auth required (parents aren't logged in).
 * Principle 2 (API Contract): Zod-validated request, standardized JSON response.
 * Principle 6 (Separation): route validates + persists only; no business logic.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Bounded, flexible payload — answers shape can differ per survey, but each
// value is constrained so a single submission can't dump unbounded data.
const SubmitSchema = z.object({
  survey_slug: z.string().min(1).max(80),
  survey_type: z.string().min(1).max(40).default('workshop_feedback'),
  answers: z
    .record(z.string().max(60), z.union([z.string().max(4000), z.number(), z.boolean(), z.null()]))
    .refine((a) => Object.keys(a).length <= 40, 'Too many answer fields'),
  name: z.string().max(120).optional().nullable(),
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_FAILED', message: 'Invalid submission', details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const { survey_slug, survey_type, answers, name, email } = parsed.data;

    const supabase = createServiceRoleClient();
    const { error } = await supabase.from('survey_responses').insert({
      survey_slug,
      survey_type,
      answers,
      name: name?.trim() || null,
      email: email?.trim() || null,
      user_agent: request.headers.get('user-agent')?.slice(0, 400) ?? null,
    });

    if (error) {
      console.error('[surveys/submit] insert failed:', error.message);
      return NextResponse.json(
        { success: false, error: { code: 'INTERNAL_ERROR', message: 'Could not save your response' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error('[surveys/submit] unexpected error:', err);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 }
    );
  }
}
