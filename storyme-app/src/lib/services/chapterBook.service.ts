/**
 * Chapter Book Service
 * Business logic for chapter_book-flavored projects: Tiptap-backed text books
 * older kids (ages 7–12) write themselves. Picture-book paths are unaffected
 * — this service only operates on rows with project_type='chapter_book'.
 *
 * Why a separate service: the picture-book ProjectService is tightly coupled
 * to scenes / story-bible / image-gen. Chapter books reuse the projects table
 * but have a different content model (Tiptap doc in canvas_state, no scenes),
 * so keeping the orchestration distinct keeps both flows readable.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectRepository } from '../repositories/project.repository';
import { createServiceRoleClient } from '../supabase/service-role';
import type { Project } from '../domain/models';
import { randomUUID } from 'crypto';

/** Max drawings kept per chapter book (rolling, newest-first). */
const MAX_DRAWINGS = 10;
/** Storage bucket shared with uploaded/generated images. */
const ART_BUCKET = 'generated-images';

/** Lightweight index entry stored in projects.art_drawings. */
interface DrawingIndexEntry {
  id: string;
  pngUrl: string;
  strokesUrl: string;
  w: number;
  h: number;
  v: number; // stroke-format version, for forward-compat
  createdAt: string;
}

/** Gallery list item returned to the client (no strokes). */
export interface DrawingSummary {
  id: string;
  pngUrl: string;
  w: number;
  h: number;
  createdAt: string;
}

/** Full drawing for re-editing — includes the strokes fetched from storage. */
export interface DrawingDetail extends DrawingSummary {
  strokes: unknown[];
}

/**
 * Starter document for a brand-new chapter book. Tiny scaffold so the kid
 * sees the cover-page concept without being told what to write next: the
 * cover (title + author placeholder), a page break, and an empty body.
 * No "Chapter 1" — kids who want chapters add their own headings.
 *
 * Stored as plain JSON so we don't depend on tiptap on the server.
 */
export const CHAPTER_BOOK_STARTER_DOC = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: '<Insert cover page image>' }],
    },
    {
      type: 'heading',
      attrs: { level: 1, textAlign: 'center' },
      content: [{ type: 'text', text: '<My Book Title>' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: 'by <Your Name>' }],
    },
    {
      type: 'paragraph',
      attrs: { textAlign: 'center' },
      content: [{ type: 'text', text: '© 2026 KindleWood Studio' }],
    },
    { type: 'pageBreak' },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: '<Start writing from here>' }],
    },
  ],
} as const;

export interface ChapterBookSummary {
  id: string;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorAge: number | null;
  secondaryLanguage: string | null;
  status: 'draft' | 'processing' | 'completed' | 'error';
  visibility: 'private' | 'unlisted' | 'public' | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterBookDetail extends ChapterBookSummary {
  editorDoc: Record<string, unknown> | null;
  shareToken: string | null;
}

export class ChapterBookService {
  private projectRepo: ProjectRepository;

  constructor(private supabase: SupabaseClient) {
    this.projectRepo = new ProjectRepository(supabase);
  }

  /**
   * Create a brand-new chapter book project for the user. Returns the new
   * project id so callers can redirect to the editor. The starter doc gives
   * the kid something to react to instead of a scary blank page.
   */
  async createChapterBook(
    userId: string,
    options?: { title?: string }
  ): Promise<ChapterBookSummary> {
    const title = options?.title?.trim() || 'My Chapter Book';

    const created = await this.projectRepo.create({
      user_id: userId,
      project_type: 'chapter_book',
      title,
      status: 'draft',
      visibility: 'private',
      // Tiptap doc lives in canvas_state — see migration 20260508.
      canvas_state: CHAPTER_BOOK_STARTER_DOC as unknown as Record<string, unknown>,
    } as Partial<Project>);

    return this.toSummary(created);
  }

  /**
   * Load a chapter book by id, scoped to the calling user. Throws on
   * missing or non-owner access. Wrong project_type also surfaces as
   * "not found" so callers can't probe for picture-book ids.
   */
  async getOwnedChapterBook(
    projectId: string,
    userId: string
  ): Promise<ChapterBookDetail> {
    const project = await this.projectRepo.findChapterBookById(projectId);
    if (!project) {
      throw new Error('Chapter book not found');
    }
    if (project.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }
    return this.toDetail(project);
  }

  /**
   * Update the editor doc and (optionally) the title. Owner-scoped; loads
   * the row first to verify project_type + ownership before writing.
   *
   * Doc size cap is enforced in the API route (Principle 1) so we don't
   * pay the load cost for obviously-bad payloads.
   */
  async updateChapterBook(
    projectId: string,
    userId: string,
    updates: { editorDoc?: Record<string, unknown>; title?: string }
  ): Promise<ChapterBookDetail> {
    const existing = await this.projectRepo.findChapterBookById(projectId);
    if (!existing) {
      throw new Error('Chapter book not found');
    }
    if (existing.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    const patch: Partial<Project> = {};
    if (updates.editorDoc !== undefined) {
      patch.canvas_state = updates.editorDoc as Record<string, unknown>;
    }
    if (updates.title !== undefined) {
      patch.title = updates.title.trim() || existing.title;
    }
    if (Object.keys(patch).length === 0) {
      return this.toDetail(existing);
    }

    const updated = await this.projectRepo.update(projectId, patch);
    return this.toDetail(updated);
  }

  /**
   * Save the chapter book to the user's library. Mirrors picture-book
   * "Save to My Stories": sets status='completed' but keeps visibility
   * private — the kid toggles public from the details page when they
   * choose to share.
   *
   * Accepts the metadata fields the save modal collects (title,
   * description, author info, language). Cover image is rendered
   * client-side and passed in.
   */
  async saveToLibrary(
    projectId: string,
    userId: string,
    options: {
      title?: string;
      description?: string;
      authorName?: string;
      authorAge?: number;
      language?: string;
      coverImageUrl?: string;
    }
  ): Promise<ChapterBookDetail> {
    const existing = await this.projectRepo.findChapterBookById(projectId);
    if (!existing) {
      throw new Error('Chapter book not found');
    }
    if (existing.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }

    const patch: Partial<Project> & {
      published_at?: string;
      cover_image_url?: string;
      author_name?: string;
      author_age?: number;
    } = {
      status: 'completed',
      // First-time save lands as private. If kid already had a public
      // book and is re-saving, preserve their visibility.
      visibility: existing.visibility ?? 'private',
    };

    if (options.title !== undefined) patch.title = options.title;
    if (options.description !== undefined) patch.description = options.description;
    if (options.authorName !== undefined) patch.author_name = options.authorName;
    if (options.authorAge !== undefined) patch.author_age = options.authorAge;
    if (options.language !== undefined) patch.secondary_language = options.language;
    if (options.coverImageUrl) patch.cover_image_url = options.coverImageUrl;

    const updated = await this.projectRepo.update(projectId, patch as Partial<Project>);
    return this.toDetail(updated);
  }

  /**
   * "Edit again" — kid wants to revise a saved book. Reverts to draft
   * and forces visibility back to private so the in-progress version
   * isn't shown to readers while edits are in flight. Once they save
   * again, they re-pick visibility.
   */
  async editAgain(projectId: string, userId: string): Promise<ChapterBookDetail> {
    const existing = await this.projectRepo.findChapterBookById(projectId);
    if (!existing) {
      throw new Error('Chapter book not found');
    }
    if (existing.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }
    const updated = await this.projectRepo.update(projectId, {
      status: 'draft',
      visibility: 'private',
      // share_token cleared so any outstanding share link goes dead while
      // the book is being edited; re-saving lets the kid re-share.
      share_token: null,
    } as Partial<Project>);
    return this.toDetail(updated);
  }

  /**
   * Set visibility on a saved chapter book — Private / Unlisted / Public.
   * Sets published_at the first time visibility goes public. Mirrors the
   * existing picture-book privacy toggle.
   */
  async setVisibility(
    projectId: string,
    userId: string,
    visibility: 'private' | 'unlisted' | 'public'
  ): Promise<ChapterBookDetail> {
    const existing = await this.projectRepo.findChapterBookById(projectId);
    if (!existing) {
      throw new Error('Chapter book not found');
    }
    if (existing.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }
    if (existing.status !== 'completed') {
      throw new Error('Save the book to your library before changing visibility.');
    }

    const patch: Partial<Project> & { published_at?: string } = { visibility };
    if (
      visibility === 'public' &&
      !(existing as Project & { published_at?: string | null }).published_at
    ) {
      patch.published_at = new Date().toISOString();
    }
    const updated = await this.projectRepo.update(projectId, patch as Partial<Project>);
    return this.toDetail(updated);
  }

  // ── My Art gallery (Phase 1) ─────────────────────────────────────────
  //
  // Drawings are scoped to the book and capped at 5 (newest-first). The
  // index lives in projects.art_drawings; the heavy stroke data is a JSON
  // file in storage so the hot book-load path stays light. Editing reopens
  // the drawing's strokes — never an AI-polished raster (which has none).

  private async loadOwnedIndex(
    projectId: string,
    userId: string
  ): Promise<DrawingIndexEntry[]> {
    const row = await this.projectRepo.getArtDrawings(projectId);
    if (!row) throw new Error('Chapter book not found');
    if (row.user_id !== userId) {
      throw new Error('Unauthorized: Project does not belong to you');
    }
    return (Array.isArray(row.art_drawings) ? row.art_drawings : []) as DrawingIndexEntry[];
  }

  /** List the book's recent drawings (newest-first, no strokes). */
  async listDrawings(projectId: string, userId: string): Promise<DrawingSummary[]> {
    const index = await this.loadOwnedIndex(projectId, userId);
    return index.map(({ id, pngUrl, w, h, createdAt }) => ({ id, pngUrl, w, h, createdAt }));
  }

  /** Load one drawing with its strokes (for re-editing). */
  async getDrawing(
    projectId: string,
    userId: string,
    drawingId: string
  ): Promise<DrawingDetail> {
    const index = await this.loadOwnedIndex(projectId, userId);
    const entry = index.find((d) => d.id === drawingId);
    if (!entry) throw new Error('Drawing not found');

    let strokes: unknown[] = [];
    try {
      const res = await fetch(entry.strokesUrl);
      if (res.ok) {
        const parsed = await res.json();
        if (Array.isArray(parsed)) strokes = parsed;
      }
    } catch {
      // Strokes file unreachable — return an empty editable canvas rather
      // than failing the whole edit. The PNG still exists for reference.
    }

    return {
      id: entry.id,
      pngUrl: entry.pngUrl,
      w: entry.w,
      h: entry.h,
      createdAt: entry.createdAt,
      strokes,
    };
  }

  /**
   * Save (insert or update) a drawing. New drawings get a fresh id and are
   * prepended, then the list is pruned to MAX_DRAWINGS. Editing an existing
   * id updates that entry in place and moves it to the front. Strokes are
   * written to storage; only the small index goes in the DB column.
   */
  async saveDrawing(
    projectId: string,
    userId: string,
    input: { id?: string; pngUrl: string; strokes: unknown[]; w: number; h: number }
  ): Promise<DrawingSummary> {
    const index = await this.loadOwnedIndex(projectId, userId);

    const id = input.id && index.some((d) => d.id === input.id) ? input.id : randomUUID();
    const existing = index.find((d) => d.id === id);

    // Upload strokes JSON to storage (service role, like image uploads).
    // upsert:true so re-editing overwrites the same file.
    const service = createServiceRoleClient();
    const path = `editor/${userId}/drawings/${id}.json`;
    const { error: upErr } = await service.storage
      .from(ART_BUCKET)
      .upload(path, JSON.stringify(input.strokes), {
        contentType: 'application/json',
        cacheControl: '3600',
        upsert: true,
      });
    if (upErr) throw new Error('Failed to save drawing strokes');
    const { data: { publicUrl } } = service.storage.from(ART_BUCKET).getPublicUrl(path);

    const entry: DrawingIndexEntry = {
      id,
      pngUrl: input.pngUrl,
      strokesUrl: publicUrl,
      w: input.w,
      h: input.h,
      v: 1,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    // Move to front (most-recent), drop any stale copy, prune to cap.
    const next = [entry, ...index.filter((d) => d.id !== id)].slice(0, MAX_DRAWINGS);
    await this.projectRepo.updateArtDrawings(projectId, next);

    return { id: entry.id, pngUrl: entry.pngUrl, w: entry.w, h: entry.h, createdAt: entry.createdAt };
  }

  /** Remove a drawing from the gallery index. (Storage file is left as-is.) */
  async deleteDrawing(projectId: string, userId: string, drawingId: string): Promise<void> {
    const index = await this.loadOwnedIndex(projectId, userId);
    const next = index.filter((d) => d.id !== drawingId);
    if (next.length !== index.length) {
      await this.projectRepo.updateArtDrawings(projectId, next);
    }
  }

  private toSummary(project: Project): ChapterBookSummary {
    const p = project as Project & {
      author_name?: string | null;
      author_age?: number | null;
      secondary_language?: string | null;
      published_at?: string | null;
    };
    return {
      id: project.id,
      title: project.title ?? null,
      description: project.description ?? null,
      authorName: p.author_name ?? null,
      authorAge: p.author_age ?? null,
      secondaryLanguage: p.secondary_language ?? null,
      status: project.status,
      visibility: (project.visibility ?? null) as ChapterBookSummary['visibility'],
      coverImageUrl: project.cover_image_url ?? null,
      publishedAt: p.published_at ?? null,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
    };
  }

  private toDetail(project: Project): ChapterBookDetail {
    return {
      ...this.toSummary(project),
      editorDoc: (project.canvas_state as Record<string, unknown>) ?? null,
      shareToken: project.share_token ?? null,
    };
  }
}
