/**
 * Share-link management for a story project.
 *
 *   POST   /api/projects/[id]/share-link              — enable share-link, returns URL/token
 *   POST   /api/projects/[id]/share-link  { regenerate: true }
 *                                                     — rotate token (invalidates old link)
 *   DELETE /api/projects/[id]/share-link              — revoke link, set visibility=private
 *
 * Read-side access (serving the story when a token is presented) is in
 * /api/stories/public/[id]/route.ts.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StoryShareService } from '@/lib/services/storyShare.service';

function buildShareUrl(request: NextRequest, projectId: string, token: string): string {
  const origin = request.nextUrl.origin;
  return `${origin}/stories/${projectId}?mode=reading&token=${token}`;
}

function mapErrorStatus(message: string): number {
  if (message.includes('Unauthorized')) return 403;
  if (message.includes('not found')) return 404;
  if (message.includes('Draft')) return 400;
  return 500;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let regenerate = false;
    try {
      const body = await request.json();
      regenerate = body?.regenerate === true;
    } catch {
      // Empty body is fine — defaults to enable
    }

    const service = new StoryShareService(supabase);
    const result = regenerate
      ? await service.regenerateShareToken(id, user.id)
      : await service.enableShareLink(id, user.id);

    if (!result.shareToken) {
      // Defensive: enable/regen always returns a token; treat missing as a 500.
      return NextResponse.json({ error: 'Failed to issue share token' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      visibility: result.visibility,
      shareToken: result.shareToken,
      shareUrl: buildShareUrl(request, id, result.shareToken),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update share link';
    console.error('[POST /api/projects/[id]/share-link]', error);
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const service = new StoryShareService(supabase);
    const result = await service.revokeShareLink(id, user.id);

    return NextResponse.json({
      success: true,
      visibility: result.visibility,
      shareToken: null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to revoke share link';
    console.error('[DELETE /api/projects/[id]/share-link]', error);
    return NextResponse.json({ error: message }, { status: mapErrorStatus(message) });
  }
}
