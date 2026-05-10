/**
 * API Route: GET / PATCH /api/v1/chapter-books/[id]
 *
 * GET   — load editor doc + metadata for the authed owner.
 * PATCH — auto-save the Tiptap doc and/or rename the book.
 *
 * Both surface 404 for non-owners and picture_book ids so the project
 * id space can't be probed.
 *
 * Principle 1 (Security): auth + ownership; doc size cap rejects oversized
 *   JSON before service-layer load.
 * Principle 2 (API Contract): versioned, Zod-validated, JSON envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

// Tiptap docs are JSON; cap at 2 MB to keep DB rows reasonable and reject
// accidental base64-image embeds. Real images go through the upload endpoint.
const MAX_DOC_BYTES = 2 * 1024 * 1024;

const UpdateChapterBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  editorDoc: z.record(z.string(), z.unknown()).optional(),
  // Visibility is the kid-facing privacy toggle on the details page.
  // Routed through the service so the published_at timestamp is set the
  // first time the book goes public, mirroring picture books.
  visibility: z.enum(['private', 'unlisted', 'public']).optional(),
});

function notFound() {
  return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
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
      const detail = await service.getOwnedChapterBook(id, user.id);
      return NextResponse.json({ success: true, project: detail });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Not found';
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return notFound();
      }
      throw error;
    }
  } catch (error) {
    console.error('Error loading chapter book:', error);
    return NextResponse.json({ error: 'Failed to load chapter book' }, { status: 500 });
  }
}

export async function PATCH(
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
    if (rawBody.length > MAX_DOC_BYTES) {
      return NextResponse.json(
        { error: 'Document too large. Images should be uploaded separately.' },
        { status: 413 }
      );
    }
    const body = rawBody ? JSON.parse(rawBody) : {};
    const validation = UpdateChapterBookSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const service = new ChapterBookService(supabase);
    try {
      const { visibility, ...rest } = validation.data;
      // Visibility goes through setVisibility so the service can set
      // published_at on first-public; doc/title go through the editor
      // auto-save path. Both can run in one request if the client sends
      // both fields, but typically only one or the other.
      let updated = await service.updateChapterBook(id, user.id, rest);
      if (visibility) {
        updated = await service.setVisibility(id, user.id, visibility);
      }
      return NextResponse.json({ success: true, project: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Not found';
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return notFound();
      }
      // Visibility transition errors (e.g., trying to publish a draft)
      // surface as 400s with the human message.
      if (message.includes('library before')) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Error updating chapter book:', error);
    return NextResponse.json({ error: 'Failed to update chapter book' }, { status: 500 });
  }
}
