/**
 * Public Story Detail API
 * GET /api/stories/public/[id] - Get full story details (no auth required for public stories)
 * POST /api/stories/public/[id] - Increment view/share count
 *
 * Response shape — read this before changing:
 *
 * The response carries TWO views of the same story for backward compat
 * with native mobile builds:
 *
 *   - LEGACY view (picture books):
 *       story.scenes[]  — picture-book scenes (image + caption per row)
 *       Chapter books expose scenes: [] here so older mobile builds
 *       don't crash on the field being missing.
 *
 *   - UNIFIED view (new — for mobile clients moving to one renderer):
 *       story.pages[]       — sequence of pages for both project types
 *       story.quiz          — optional quiz block (questions + audio)
 *       story.coverAudio    — optional cover-page narration
 *       Each pages[i] carries audio inline so mobile doesn't need a
 *       second fetch to play narration.
 *
 * New mobile builds should consume pages[] / quiz / coverAudio.
 * scenes[] is kept populated indefinitely for legacy clients — DO NOT
 * remove without a coordinated mobile release rollout.
 *
 * See API_MOBILE.md (root of repo) for the full spec mobile is reading.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import { docToPages } from '@/lib/chapter-book/docToPages';

// ─── Shared types for the unified shape ─────────────────────────────────
// Mirror these in any mobile-side type definitions.

interface AudioBlock {
  url: string;
  text: string | null;
  durationSeconds: number | null;
  // Secondary-language audio (when story.secondaryLanguage is set).
  // Null when the secondary track isn't generated yet.
  urlSecondary: string | null;
  textSecondary: string | null;
}

interface StoryPage {
  pageNumber: number; // 1-indexed
  kind: 'scene' | 'page';

  imageUrls: string[];
  plainText: string;

  // Rich content per kind
  html?: string;             // chapter_book pages
  caption?: string | null;   // picture_book scenes
  captionSecondary?: string | null;

  audio: AudioBlock | null;
}

interface QuizQuestionOut {
  id: string;
  order: number;
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: string | null;
  explanation: string | null;
  audio: AudioBlock | null;
}

interface QuizOut {
  questions: QuizQuestionOut[];
  transitionAudio: AudioBlock | null;
}

// Internal shape of a story_audio_pages row.
interface AudioRow {
  id: string;
  scene_id: string | null;
  quiz_question_id: string | null;
  page_type: string | null;
  page_number: number | null;
  audio_url: string | null;
  audio_url_secondary: string | null;
  text_content: string | null;
  text_content_secondary: string | null;
}

interface QuizRow {
  id: string;
  question_order: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  explanation: string | null;
}

function toAudioBlock(row: AudioRow | undefined | null): AudioBlock | null {
  if (!row || !row.audio_url) return null;
  return {
    url: row.audio_url,
    text: row.text_content,
    durationSeconds: null, // not stored today; null until/if we capture it
    urlSecondary: row.audio_url_secondary,
    textSecondary: row.text_content_secondary,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const tokenParam = request.nextUrl.searchParams.get('token');

    // Use the service-role client for the read so unauthenticated visitors
    // (e.g. parents opening a share link without an account) can fetch
    // unlisted stories. RLS on the projects table only permits anon SELECTs
    // for public rows; the visibility/token gate below is the actual auth
    // boundary for this endpoint.
    const supabase = createServiceRoleClient();

    // Fetch full story with all scenes and images. canvas_state is the
    // Tiptap doc for chapter books — null/unused for picture books, but
    // we always pull it so a single query covers both project types.
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        id,
        project_type,
        title,
        description,
        canvas_state,
        visibility,
        share_token,
        featured,
        view_count,
        like_count,
        share_count,
        published_at,
        reading_level,
        story_tone,
        created_at,
        cover_image_url,
        author_name,
        author_age,
        secondary_language,
        scenes (
          id,
          scene_number,
          description,
          caption,
          caption_chinese,
          caption_secondary,
          generated_images (
            id,
            image_url,
            prompt
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Story not found' },
          { status: 404 }
        );
      }
      throw error;
    }

    // Access gate: public stories are open. Unlisted stories require a matching
    // share-link token. Anything else (private, mismatched token) is rejected
    // with the same 403 to avoid leaking visibility state to scrapers.
    const isPublic = project.visibility === 'public';
    const isUnlistedWithMatchingToken =
      project.visibility === 'unlisted' &&
      !!project.share_token &&
      !!tokenParam &&
      tokenParam === project.share_token;

    if (!isPublic && !isUnlistedWithMatchingToken) {
      return NextResponse.json(
        { error: 'This story is private' },
        { status: 403 }
      );
    }

    // Counters are frozen for unlisted (token-served) views — only public
    // views accrue analytics so unlisted stays a clean "preview" channel.
    const incrementViews = isPublic;
    if (incrementViews) {
      await supabase
        .from('projects')
        .update({ view_count: (project.view_count || 0) + 1 })
        .eq('id', id);
    }

    // Fetch audio + quiz in parallel — both feed the unified shape.
    // We always run these; for books with no audio / no quiz they
    // return empty results, not errors.
    const [{ data: audioRowsRaw }, { data: quizRowsRaw }] = await Promise.all([
      supabase
        .from('story_audio_pages')
        .select('id, scene_id, quiz_question_id, page_type, page_number, audio_url, audio_url_secondary, text_content, text_content_secondary')
        .eq('project_id', id),
      supabase
        .from('quiz_questions')
        .select('id, question_order, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
        .eq('project_id', id)
        .order('question_order', { ascending: true }),
    ]);
    const audioRows: AudioRow[] = (audioRowsRaw as AudioRow[] | null) ?? [];
    const quizRows: QuizRow[] = (quizRowsRaw as QuizRow[] | null) ?? [];

    // Index audio rows for O(1) lookup while building pages/quiz.
    //
    // ASSUMPTION (verify when chapter-book narration ships): rows with
    // page_type='page' use page_number = the doc's 1-indexed page
    // number (matching docToPages output). If the audio generator
    // writes 0-indexed numbers instead, the lookup below will always
    // miss for chapter books. Worth one integration test the first
    // time a chapter-book audio job runs.
    const sceneAudioByScene = new Map<string, AudioRow>();
    const pageAudioByNumber = new Map<number, AudioRow>();
    const quizAudioByQuestion = new Map<string, AudioRow>();
    let coverAudioRow: AudioRow | undefined;
    let quizTransitionRow: AudioRow | undefined;
    for (const row of audioRows) {
      switch (row.page_type) {
        case 'cover':
          coverAudioRow = row;
          break;
        case 'scene':
          if (row.scene_id) sceneAudioByScene.set(row.scene_id, row);
          break;
        case 'page':
          if (row.page_number != null) pageAudioByNumber.set(row.page_number, row);
          break;
        case 'quiz_transition':
          quizTransitionRow = row;
          break;
        case 'quiz_question':
          if (row.quiz_question_id) quizAudioByQuestion.set(row.quiz_question_id, row);
          break;
      }
    }

    // Format response. Picture books expose `scenes` (legacy) AND the
    // new unified `pages` / `quiz` / `coverAudio` block. Chapter books
    // expose `pages` from docToPages; `scenes` stays empty for legacy
    // mobile clients that always read .scenes regardless of type.
    const isChapterBook = project.project_type === 'chapter_book';

    // ── Legacy scenes[] block (kept for back-compat) ─────────────────────
    const legacyScenes = isChapterBook
      ? []
      : (project.scenes || [])
          .slice() // don't mutate the original
          .sort((a: any, b: any) => a.scene_number - b.scene_number)
          .map((scene: any) => ({
            id: scene.id,
            sceneNumber: scene.scene_number,
            description: scene.description,
            caption: scene.caption,
            captionChinese: scene.caption_chinese,
            captionSecondary: scene.caption_secondary,
            imageUrl: scene.generated_images?.[0]?.image_url || null,
            prompt: scene.generated_images?.[0]?.prompt || null,
          }));

    // ── Unified pages[] block (new — for modern mobile clients) ─────────
    const pages: StoryPage[] = isChapterBook
      ? docToPages(project.canvas_state ?? null).map((p) => ({
          pageNumber: p.pageNumber,
          kind: 'page' as const,
          imageUrls: p.imageUrls,
          plainText: p.plainText,
          html: p.html,
          audio: toAudioBlock(pageAudioByNumber.get(p.pageNumber)),
        }))
      : (project.scenes || [])
          .slice()
          .sort((a: any, b: any) => a.scene_number - b.scene_number)
          .map((scene: any) => ({
            pageNumber: scene.scene_number,
            kind: 'scene' as const,
            imageUrls: scene.generated_images?.[0]?.image_url
              ? [scene.generated_images[0].image_url]
              : [],
            // plainText is the PRIMARY-language narration / accessibility
            // text. captionSecondary lives on its own field — do NOT
            // fall back to it here or kids with translated stories will
            // get the wrong language for TTS / screen readers / search.
            plainText: scene.caption || scene.description || '',
            caption: scene.caption,
            captionSecondary: scene.caption_secondary ?? scene.caption_chinese ?? null,
            audio: toAudioBlock(sceneAudioByScene.get(scene.id)),
          }));

    // ── Quiz block (when questions exist) ───────────────────────────────
    const quiz: QuizOut | null =
      quizRows.length > 0
        ? {
            questions: quizRows.map((q) => ({
              id: q.id,
              order: q.question_order,
              question: q.question,
              options: {
                A: q.option_a,
                B: q.option_b,
                C: q.option_c,
                D: q.option_d,
              },
              correctAnswer: q.correct_answer,
              explanation: q.explanation,
              audio: toAudioBlock(quizAudioByQuestion.get(q.id)),
            })),
            transitionAudio: toAudioBlock(quizTransitionRow),
          }
        : null;

    // ── Final response envelope ──────────────────────────────────────────
    const formattedStory = {
      // Metadata (unchanged from previous response)
      id: project.id,
      projectType: project.project_type,
      title: project.title,
      description: project.description,
      visibility: project.visibility,
      featured: project.featured,
      viewCount: incrementViews ? (project.view_count || 0) + 1 : (project.view_count || 0),
      likeCount: project.like_count,
      shareCount: project.share_count,
      publishedAt: project.published_at,
      readingLevel: project.reading_level,
      storyTone: project.story_tone,
      createdAt: project.created_at,
      coverImageUrl: project.cover_image_url,
      authorName: project.author_name,
      authorAge: project.author_age,
      secondaryLanguage: project.secondary_language,

      // NEW unified fields (mobile-facing — see API_MOBILE.md)
      pages,
      quiz,
      coverAudio: toAudioBlock(coverAudioRow),

      // LEGACY field (still populated for old mobile builds)
      scenes: legacyScenes,
    };

    return NextResponse.json({
      success: true,
      story: formattedStory,
    });

  } catch (error) {
    console.error('Error fetching public story:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { action, platform } = body; // action: 'view' | 'share', platform: 'twitter' | 'facebook' | etc.

    if (!action || !['view', 'share'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "view" or "share"' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify story exists and is public
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('id, visibility, view_count, share_count')
      .eq('id', id)
      .single();

    if (fetchError || !project) {
      return NextResponse.json(
        { error: 'Story not found' },
        { status: 404 }
      );
    }

    // Counters are only tracked for public stories. Unlisted views are a
    // private channel and don't accrue view/share metrics.
    if (project.visibility !== 'public') {
      return NextResponse.json(
        { error: 'This story is private' },
        { status: 403 }
      );
    }

    // Increment the appropriate counter
    const updateField = action === 'view' ? 'view_count' : 'share_count';
    const currentValue = action === 'view' ? project.view_count : project.share_count;

    const { error: updateError } = await supabase
      .from('projects')
      .update({ [updateField]: (currentValue || 0) + 1 })
      .eq('id', id);

    if (updateError) {
      throw updateError;
    }

    // TODO: Track share platform in analytics table (future enhancement)

    return NextResponse.json({
      success: true,
      action,
      newCount: (currentValue || 0) + 1,
      message: `${action} count incremented`,
    });

  } catch (error) {
    console.error('Error updating story metrics:', error);
    return NextResponse.json(
      { error: 'Failed to update metrics' },
      { status: 500 }
    );
  }
}
