/**
 * API Route: GET / DELETE /api/v1/chapter-books/[id]/drawings/[drawingId]
 *
 *   GET    — load one drawing WITH its strokes (only when re-editing).
 *   DELETE — remove a drawing from the gallery index.
 *
 * Principle 1 (Security): auth + ownership via ChapterBookService; non-owner
 *   / picture-book ids surface as 404.
 * Principle 2 (API Contract): versioned, JSON envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
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
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const { id, drawingId } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new ChapterBookService(supabase);
    try {
      const drawing = await service.getDrawing(id, user.id, drawingId);
      return NextResponse.json({ success: true, drawing });
    } catch (error) {
      return mapError(error);
    }
  } catch (error) {
    console.error('Error loading drawing:', error);
    return NextResponse.json({ error: 'Failed to load drawing' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; drawingId: string }> }
) {
  try {
    const { id, drawingId } = await params;
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new ChapterBookService(supabase);
    try {
      await service.deleteDrawing(id, user.id, drawingId);
      return NextResponse.json({ success: true });
    } catch (error) {
      return mapError(error);
    }
  } catch (error) {
    console.error('Error deleting drawing:', error);
    return NextResponse.json({ error: 'Failed to delete drawing' }, { status: 500 });
  }
}
