/**
 * API Route: POST /api/v1/chapter-books/[id]/save
 *
 * Saves a chapter book to the kid's library — the chapter-book equivalent
 * of the picture-book "Save to My Stories" flow. Sets status='completed'
 * and visibility='private' (kid toggles public separately on the details
 * page, mirroring picture books).
 *
 * Accepts the metadata fields the save modal collects: title, description,
 * author name, author age, secondary language, and the cover image URL
 * (rendered client-side from the editor's first page).
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

const SaveSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  authorName: z.string().max(80).optional(),
  authorAge: z.number().int().min(3).max(18).optional(),
  language: z.string().max(10).optional(),
  coverImageUrl: z.string().url().optional(),
});

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

    const body = await request.json().catch(() => ({}));
    const validation = SaveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const service = new ChapterBookService(supabase);
    try {
      const updated = await service.saveToLibrary(id, user.id, validation.data);
      return NextResponse.json({ success: true, project: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('save chapter book error:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
