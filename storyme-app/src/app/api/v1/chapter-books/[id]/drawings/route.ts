/**
 * API Route: GET / POST /api/v1/chapter-books/[id]/drawings
 *
 * My Art "Recent drawings" gallery for a chapter book (Phase 1).
 *   GET  — list the book's recent drawings (newest-first, no strokes).
 *   POST — save (insert or update) a drawing; prunes to the 10 most recent.
 *
 * Drawings are scoped to the book; a new chapter book starts empty. Heavy
 * stroke data is stored in Supabase Storage; only a small index lives on the
 * project row (see migration 20260618).
 *
 * Principle 1 (Security): auth + ownership via ChapterBookService; non-owner
 *   / picture-book ids surface as 404. Payload size capped.
 * Principle 2 (API Contract): versioned, Zod-validated, JSON envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

// Strokes are vector data, not images — a large drawing is still small JSON.
// Cap the whole request to keep storage objects + DB indexes reasonable.
const MAX_BODY_BYTES = 3 * 1024 * 1024;

const StrokeSchema = z.object({
  points: z.array(z.array(z.number())).max(20000),
  color: z.string().max(32),
  size: z.number(),
  erase: z.boolean(),
});

const SaveDrawingSchema = z.object({
  // Present when editing an existing drawing; absent for a new one.
  id: z.string().uuid().optional(),
  pngUrl: z.string().url(),
  strokes: z.array(StrokeSchema).max(5000),
  w: z.number().int().positive().max(20000),
  h: z.number().int().positive().max(20000),
});

function notFound() {
  return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
}

function mapError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Error';
  if (message.includes('not found') || message.includes('Unauthorized')) {
    return notFound();
  }
  throw error;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new ChapterBookService(supabase);
    try {
      const drawings = await service.listDrawings(id, user.id);
      return NextResponse.json({ success: true, drawings });
    } catch (error) {
      return mapError(error);
    }
  } catch (error) {
    console.error('Error listing drawings:', error);
    return NextResponse.json({ error: 'Failed to list drawings' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Drawing is too large to save.' }, { status: 413 });
    }
    const body = rawBody ? JSON.parse(rawBody) : {};
    const validation = SaveDrawingSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const service = new ChapterBookService(supabase);
    try {
      const drawing = await service.saveDrawing(id, user.id, validation.data);
      return NextResponse.json({ success: true, drawing });
    } catch (error) {
      return mapError(error);
    }
  } catch (error) {
    console.error('Error saving drawing:', error);
    return NextResponse.json({ error: 'Failed to save drawing' }, { status: 500 });
  }
}
