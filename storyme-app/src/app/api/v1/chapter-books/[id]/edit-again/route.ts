/**
 * API Route: POST /api/v1/chapter-books/[id]/edit-again
 *
 * Reverts a saved chapter book back to draft so the kid can keep writing.
 * Resets visibility to private and clears any active share token —
 * protects the kid from showing an in-progress version to readers while
 * they edit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { ChapterBookService } from '@/lib/services/chapterBook.service';

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

    const service = new ChapterBookService(supabase);
    try {
      const updated = await service.editAgain(id, user.id);
      return NextResponse.json({ success: true, project: updated });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed';
      if (message.includes('not found') || message.includes('Unauthorized')) {
        return NextResponse.json({ error: 'Chapter book not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('edit-again chapter book error:', error);
    return NextResponse.json({ error: 'Failed to revert to draft' }, { status: 500 });
  }
}
