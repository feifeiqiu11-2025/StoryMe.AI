/**
 * Story Share Service
 * Manages unlisted share-link state on story projects: enabling a token,
 * rotating it (revokes any outstanding link), and disabling sharing entirely.
 *
 * Read-side access (serving an unlisted story when a valid ?token= is
 * presented) lives in /api/stories/public/[id]/route.ts — keeping write
 * operations here means RLS-bypass logic and ownership checks live in one
 * place.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

export interface ShareLinkState {
  visibility: 'private' | 'unlisted' | 'public';
  shareToken: string | null;
}

export class StoryShareService {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Verify the caller owns the project. Throws on missing or unauthorized.
   * Returns current visibility/share_token so callers don't need a second read.
   */
  private async loadOwnedProject(projectId: string, userId: string): Promise<ShareLinkState> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('user_id, status, visibility, share_token')
      .eq('id', projectId)
      .single();

    if (error || !data) {
      throw new Error('Project not found');
    }
    if (data.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }
    if (data.status === 'draft') {
      throw new Error('Draft stories cannot be shared. Complete the story first.');
    }

    return {
      visibility: data.visibility,
      shareToken: data.share_token,
    };
  }

  /**
   * Enable share-link on a story. If the story is already unlisted with a
   * token, returns the existing token (idempotent). Otherwise sets
   * visibility='unlisted' and generates a fresh token. Public stories that
   * opt into share-link become unlisted (they leave the community page).
   */
  async enableShareLink(projectId: string, userId: string): Promise<ShareLinkState> {
    const current = await this.loadOwnedProject(projectId, userId);

    if (current.visibility === 'unlisted' && current.shareToken) {
      return current;
    }

    const newToken = randomUUID();
    const { error } = await this.supabase
      .from('projects')
      .update({ visibility: 'unlisted', share_token: newToken })
      .eq('id', projectId);

    if (error) throw error;

    return { visibility: 'unlisted', shareToken: newToken };
  }

  /**
   * Rotate the share token, immediately invalidating any outstanding link.
   * Forces visibility='unlisted' so callers can use this from any state.
   */
  async regenerateShareToken(projectId: string, userId: string): Promise<ShareLinkState> {
    await this.loadOwnedProject(projectId, userId);

    const newToken = randomUUID();
    const { error } = await this.supabase
      .from('projects')
      .update({ visibility: 'unlisted', share_token: newToken })
      .eq('id', projectId);

    if (error) throw error;

    return { visibility: 'unlisted', shareToken: newToken };
  }

  /**
   * Revoke share-link: clear the token and make the story private. Used when
   * a teacher wants to fully unshare. We always land on 'private' here so the
   * UI state machine stays simple — re-enabling will mint a new token.
   */
  async revokeShareLink(projectId: string, userId: string): Promise<ShareLinkState> {
    await this.loadOwnedProject(projectId, userId);

    const { error } = await this.supabase
      .from('projects')
      .update({ visibility: 'private', share_token: null })
      .eq('id', projectId);

    if (error) throw error;

    return { visibility: 'private', shareToken: null };
  }
}
