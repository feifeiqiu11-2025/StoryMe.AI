/**
 * API Route: POST /api/v1/chapter-books
 * Create a new chapter-book project. Returns { id } so the caller can
 * redirect to /chapter-books/[id]/edit.
 *
 * Principle 1 (Security): Auth required; only the authed user can create
 *   a project for themselves.
 * Principle 2 (API Contract): Zod-validated request, standardized JSON
 *   response, versioned under /api/v1.
 * Principle 6 (Separation): Delegates to ChapterBookService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

const CreateChapterBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Body is optional — kids who hit "Start writing" with no input get
    // the default starter title.
    const rawBody = await request.text();
    const body = rawBody ? JSON.parse(rawBody) : {};
    const validation = CreateChapterBookSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const service = new ChapterBookService(supabase);
    const created = await service.createChapterBook(user.id, validation.data);

    return NextResponse.json({ success: true, project: created }, { status: 201 });
  } catch (error) {
    console.error('Error creating chapter book:', error);
    const message = error instanceof Error ? error.message : 'Failed to create chapter book';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
