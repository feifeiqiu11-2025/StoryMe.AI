/**
 * /chapter-books/[id] — chapter-book details / management page.
 *
 * Mirrors the picture-book /projects/[id] layout one-for-one so kids
 * (and reviewers) get the same shape regardless of project type:
 *
 *   - Header: ← Back link
 *   - Title, description, meta line (pages count · date)
 *   - Carousel: page-by-page preview (cover slide first, then each page
 *     rendered as a book-page snippet)
 *   - Story Actions: Edit, Read Mode, Audio Ready, Record Audio,
 *     Quiz Ready, Customize & Export
 *   - Publishing: Public toggle, Spotify, Kids App
 *   - Tags & Categories: shared TagSelector
 *   - Danger zone: Delete
 *
 * Audio / Spotify / Kids App / Quiz are visible-but-disabled — Phase B
 * will wire them. Until then the buttons keep visual parity with picture
 * books and show a tooltip explaining "Coming soon".
 */

'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import { createClient } from '@/lib/supabase/client';
import ExportPdfModal from '@/components/pdf/ExportPdfModal';
import { ShareLinkPopover } from '@/components/story/ShareLinkPopover';
import TagSelector from '@/components/story/TagSelector';
import { downloadChapterBookPDF, type ChapterBookPdfFormat } from '@/lib/pdf/chapterBookRenderer';
import { docToPages } from '@/lib/chapter-book/docToPages';
import type { StoryTag } from '@/lib/types/story';

type Visibility = 'private' | 'unlisted' | 'public';

interface BookDetail {
  id: string;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorAge: number | null;
  status: 'draft' | 'processing' | 'completed' | 'error';
  visibility: Visibility | null;
  coverImageUrl: string | null;
  shareToken: string | null;
  publishedAt: string | null;
  createdAt: string;
  editorDoc: Record<string, unknown> | null;
  tags?: StoryTag[];
}

export default function ChapterBookDetailsPage() {
  return (
    <Suspense fallback={null}>
      <Body />
    </Suspense>
  );
}

function Body() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [book, setBook] = useState<BookDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<'visibility' | 'edit-again' | 'delete' | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  // Initial load — also fetches project_tags so TagSelector seeds correctly.
  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/v1/chapter-books/${id}`);
        const data = await res.json();
        if (!res.ok) {
          if (res.status === 404) {
            setError('This chapter book is missing or not yours.');
            return;
          }
          throw new Error(data?.error || 'Failed to load.');
        }

        // Pull the project's tags via the same shape picture-books use.
        // TagSelector expects StoryTag[]; the chapter-book API doesn't
        // hydrate them yet, so do a lightweight follow-up read.
        const supabase = createClient();
        const { data: tagRows } = await supabase
          .from('project_tags')
          .select('tag_id, story_tags (id, name, slug, icon, category, parent_id, is_leaf, display_order, created_at)')
          .eq('project_id', id);

        type TagJoinRow = {
          tag_id: string;
          story_tags: {
            id: string;
            name: string;
            slug: string;
            icon: string | null;
            category: string | null;
            parent_id: string | null;
            is_leaf: boolean | null;
            display_order: number;
            created_at: string;
          } | null;
        };
        const tags: StoryTag[] = ((tagRows as TagJoinRow[] | null) || [])
          .map((row) => row.story_tags)
          .filter((t): t is NonNullable<TagJoinRow['story_tags']> => t !== null)
          .map((t) => ({
            id: t.id,
            name: t.name,
            slug: t.slug,
            icon: t.icon ?? undefined,
            category: t.category ?? undefined,
            parentId: t.parent_id ?? null,
            isLeaf: t.is_leaf ?? true,
            displayOrder: t.display_order,
            createdAt: t.created_at,
          }));

        setBook({ ...data.project, tags });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    };
    load();
  }, [id]);

  // Drafts belong in the editor — bounce them.
  useEffect(() => {
    if (book && book.status === 'draft' && id) {
      router.replace(`/chapter-books/${id}/edit`);
    }
  }, [book, id, router]);

  // Carousel slides come straight from the doc — page 1 of the doc IS the
  // cover, so we don't show coverImageUrl as a separate slide (it would
  // duplicate page 1). Cover image is still used for tile thumbnails on
  // My Stories / Community feed.
  const slides = useMemo(() => {
    const pages = docToPages(book?.editorDoc ?? null);
    if (pages.length === 0 && book?.coverImageUrl) {
      // Fallback: pre-doc-format projects might only have a cover image.
      return [{ kind: 'cover' as const }];
    }
    return pages.map((p) => ({ kind: 'page' as const, html: p.html, pageNumber: p.pageNumber }));
  }, [book?.editorDoc, book?.coverImageUrl]);

  const totalSlides = slides.length;
  // Clamp index when slides change.
  useEffect(() => {
    if (currentPageIndex >= totalSlides) setCurrentPageIndex(0);
  }, [totalSlides, currentPageIndex]);

  const setVisibility = useCallback(async (v: Visibility) => {
    if (!book || updating) return;
    setUpdating('visibility');
    try {
      const res = await fetch(`/api/v1/chapter-books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibility: v }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not update visibility.');
      setBook((prev) => (prev ? { ...prev, visibility: v, publishedAt: data.project.publishedAt ?? prev.publishedAt } : prev));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not update visibility.');
    } finally {
      setUpdating(null);
    }
  }, [book, updating]);

  const onEditAgain = useCallback(async () => {
    if (!book || updating) return;
    if (!confirm('Edit again? Your book will go back to draft and be hidden until you save it again.')) return;
    setUpdating('edit-again');
    try {
      const res = await fetch(`/api/v1/chapter-books/${book.id}/edit-again`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not revert.');
      router.push(`/chapter-books/${book.id}/edit`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not revert.');
      setUpdating(null);
    }
  }, [book, updating, router]);

  const onDelete = useCallback(async () => {
    if (!book || updating) return;
    setUpdating('delete');
    try {
      const supabase = createClient();
      const { error: delError } = await supabase.from('projects').delete().eq('id', book.id);
      if (delError) throw delError;
      router.push('/projects');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete.');
      setUpdating(null);
      setConfirmDelete(false);
    }
  }, [book, updating, router]);

  const onExportPdf = useCallback(
    async (format: ChapterBookPdfFormat) => {
      if (!book) return;
      setExporting(true);
      try {
        await downloadChapterBookPDF(book.editorDoc ?? null, {
          title: book.title ?? 'Chapter Book',
          authorName: book.authorName,
          format,
        });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'PDF export failed.');
      } finally {
        setExporting(false);
        setShowPdf(false);
      }
    },
    [book]
  );

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-3">{error}</p>
          <Link
            href="/projects"
            className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Back to My Stories
          </Link>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div
            className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"
            role="status"
            aria-label="Loading your chapter book"
          />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  const visibility: Visibility = (book.visibility ?? 'private') as Visibility;
  const isPublic = visibility === 'public';
  const isUnlisted = visibility === 'unlisted';
  const totalPages = docToPages(book.editorDoc ?? null).length;
  const formattedDate = new Date(book.createdAt).toLocaleDateString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  });

  const currentSlide = slides[currentPageIndex] ?? slides[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Back link */}
        <Link
          href="/projects"
          className="inline-block text-sm text-blue-600 hover:underline mb-4"
        >
          ← Back to My Stories
        </Link>

        {/* Title + description + meta */}
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          {book.title || 'Untitled'}
        </h1>
        {book.description && (
          <p className="text-gray-700 text-lg leading-relaxed max-w-3xl mb-3">
            {book.description}
          </p>
        )}
        <div className="text-sm text-gray-500 flex flex-wrap items-center gap-2 mb-6">
          <span>{totalPages} {totalPages === 1 ? 'page' : 'pages'}</span>
          <span aria-hidden>•</span>
          <span>{formattedDate}</span>
          <span aria-hidden>•</span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold uppercase tracking-wider">
            Chapter Book
          </span>
        </div>

        {/* Carousel — no outer card. The book page itself is the only
            visible chrome, floating on the page background. Saves a
            row of vertical space and removes the double-border feel.
            Nav arrows live at the outer edges; page counter and dots
            live on the book page itself so they don't drift far away. */}
        <div className="relative h-[480px] sm:h-[560px] flex items-center justify-center mb-6">
          {/* Book page frame: portrait 3:4, height fills the carousel
              area so every slide occupies the same shape. */}
          <div className="relative bg-white shadow-md rounded-md h-full aspect-[3/4] overflow-hidden">
            {currentSlide?.kind === 'cover' && book.coverImageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={book.coverImageUrl}
                alt={book.title || 'Cover'}
                className="w-full h-full object-contain"
              />
            ) : currentSlide?.kind === 'page' && currentSlide.html ? (
              <PagePreview html={currentSlide.html} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No content yet
              </div>
            )}

            {/* Page counter — anchored to the book page's top-right */}
            {totalSlides > 1 && (
              <div className="absolute top-3 right-3 bg-black/60 text-white px-2.5 py-0.5 rounded-full text-xs font-semibold">
                {currentPageIndex + 1} / {totalSlides}
              </div>
            )}

            {/* Pagination dots — anchored to the book page's bottom */}
            {totalSlides > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/60 px-2.5 py-1 rounded-full max-w-[80%] overflow-x-auto">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentPageIndex(idx)}
                    aria-label={`Go to page ${idx + 1}`}
                    className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                      idx === currentPageIndex ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/75 w-1.5'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Nav arrows — sit at the carousel container's edges so they
              don't crowd the book page. */}
          {totalSlides > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentPageIndex((i) => Math.max(0, i - 1))}
                disabled={currentPageIndex === 0}
                aria-label="Previous page"
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setCurrentPageIndex((i) => Math.min(totalSlides - 1, i + 1))}
                disabled={currentPageIndex === totalSlides - 1}
                aria-label="Next page"
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 bg-black/60 hover:bg-black/80 text-white p-3 rounded-full transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>

        {/* Single card hosting all the management sections. Each section
            is just a labeled row with a thin top divider — no nested
            boxes, no double borders. Picture-book detail page groups
            actions the same way for visual coherence. */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-5 divide-y divide-gray-100">
          <section className="pb-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Story Actions
            </h2>
            <div className="flex flex-wrap gap-2">
              <ActionButton
                tone="amber"
                onClick={onEditAgain}
                disabled={updating === 'edit-again'}
                icon="✏️"
                label="Edit"
              />
              {/* Owner reading their own book always uses preview mode
                  so private/unlisted books load. The reader hides the
                  "PREVIEW" banner when the book is public. */}
              <Link
                href={`/chapter-books/${book.id}/read?preview=1`}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-purple-600 text-white text-sm font-bold hover:bg-purple-700"
              >
                <span aria-hidden>📖</span>
                <span>Read Mode</span>
              </Link>
              <DisabledAction
                tone="green"
                icon="🎵"
                label="Audio"
                tooltip="Coming soon — auto-narrate your book page by page."
              />
              <DisabledAction
                tone="pink"
                icon="🎤"
                label="Record Audio"
                tooltip="Coming soon — record your own narration."
              />
              <button
                type="button"
                onClick={() => setShowPdf(true)}
                className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700"
              >
                <span aria-hidden>📄</span>
                <span>Export</span>
              </button>
            </div>
          </section>

          <section className="py-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
              Publishing
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setVisibility(isPublic ? 'private' : 'public')}
                disabled={updating === 'visibility'}
                className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50 ${
                  isPublic ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title={isPublic ? 'Make private' : 'Show in Community Stories'}
              >
                <span aria-hidden>🌍</span>
                <span>{isPublic ? 'Public' : 'Make Public'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowShare(true)}
                disabled={updating === 'visibility'}
                className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50 ${
                  isUnlisted ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                title="Share with a private link"
              >
                <span aria-hidden>🔗</span>
                <span>{isUnlisted ? 'Link Active' : 'Share Link'}</span>
              </button>
              <DisabledAction
                tone="dark"
                icon="🎧"
                label="Spotify"
                tooltip="Coming soon — needs narration first."
              />
              <DisabledAction
                tone="blue"
                icon="📱"
                label="Kids App"
                tooltip="Coming soon — needs narration first."
              />
            </div>
          </section>

          {/* TagSelector with unwrapped + hideEmojis so it renders
              naked into the parent card and matches the rest of the
              page's emoji-free presentation. */}
          <section className="py-5">
            <TagSelector
              projectId={book.id}
              initialTags={book.tags || []}
              unwrapped
              hideEmojis
            />
          </section>

          <section className="pt-5">
            <h2 className="text-xs font-bold text-red-700 uppercase tracking-wider mb-3">
              Danger Zone
            </h2>
            {confirmDelete ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-700">Delete this book? This can&apos;t be undone.</span>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={updating === 'delete'}
                  className="px-3 h-9 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {updating === 'delete' ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 h-9 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold border border-red-300 bg-white text-red-700 hover:bg-red-50"
              >
                Delete Book
              </button>
            )}
          </section>
        </div>
      </div>

      {/* Modals */}
      {showShare && book && (
        <ShareLinkPopover
          storyId={book.id}
          storyTitle={book.title || 'Chapter Book'}
          visibility={visibility}
          shareToken={book.shareToken}
          onClose={() => setShowShare(false)}
          onUpdated={(next) => {
            setBook((prev) =>
              prev
                ? { ...prev, visibility: next.visibility, shareToken: next.shareToken }
                : prev
            );
          }}
        />
      )}
      <ExportPdfModal
        open={showPdf}
        onClose={() => setShowPdf(false)}
        onExport={(format) => onExportPdf(format as ChapterBookPdfFormat)}
        exporting={exporting}
        projectType="chapter_book"
      />
    </div>
  );
}

/** Renders a sanitized HTML page snippet inside a fixed-aspect book page. */
function PagePreview({ html }: { html: string }) {
  const safe = useMemo(
    () =>
      DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 's', 'br',
          'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'img', 'a', 'span', 'mark', 'div'],
        ALLOWED_ATTR: ['src', 'alt', 'title', 'href', 'target', 'rel', 'class', 'style', 'data-align', 'data-fullbleed'],
      }),
    [html]
  );
  // container-type on the prose div lets data-fullbleed='true' images
  // stretch to the prose's full inner width via the @container rule
  // below — without it, the cap below would shrink the cover to 180px.
  return (
    <div className="w-full h-full overflow-y-auto bg-white p-4 sm:p-6">
      <div
        className="chapter-book-prose"
        style={{ containerType: 'inline-size', containerName: 'editor-card' }}
        dangerouslySetInnerHTML={{ __html: safe }}
      />
      <style jsx global>{`
        .chapter-book-prose {
          font-family: 'Lora', Georgia, 'Times New Roman', serif;
          font-size: 13px;
          line-height: 1.55;
          color: #1f2937;
        }
        .chapter-book-prose h1 { font-size: 1.25rem; font-weight: 700; margin: 0.4rem 0 0.3rem; }
        .chapter-book-prose h2 { font-size: 1rem; font-weight: 700; margin: 0.6rem 0 0.3rem; }
        .chapter-book-prose p { margin: 0.35rem 0; }
        .chapter-book-prose ul { list-style-type: disc; padding-left: 1.25rem; margin: 0.35rem 0; }
        .chapter-book-prose ol { list-style-type: decimal; padding-left: 1.25rem; margin: 0.35rem 0; }
        .chapter-book-prose blockquote {
          border-left: 2px solid #9ca3af; padding-left: 0.5rem;
          margin: 0.5rem 0; color: #4b5563; font-style: italic;
        }
        /* Cap preview images so the book-page frame stays balanced even
           when one page has a large hero illustration. */
        .chapter-book-prose img {
          max-width: 100%;
          max-height: 180px;
          height: auto;
          width: auto;
          object-fit: contain;
          border-radius: 4px;
          margin: 0.5rem 0;
          display: block;
        }
        .chapter-book-prose img[data-align='center'],
        .chapter-book-prose img:not([data-align]) { margin-left: auto; margin-right: auto; }
        .chapter-book-prose img[data-align='left']  { float: left;  margin-right: 0.5rem; max-width: 50%; clear: left; }
        .chapter-book-prose img[data-align='right'] { float: right; margin-left: 0.5rem;  max-width: 50%; clear: right; }
        /* Full-bleed images escape the 180px cap so book covers (page 1)
           render at the full page-frame width instead of looking like a
           postage stamp. Declared LAST + !important to override align/cap. */
        @container editor-card (min-width: 1px) {
          .chapter-book-prose img[data-fullbleed='true'] {
            width: 100cqi !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            margin: 0.5rem 0 !important;
            float: none !important;
            display: block !important;
          }
        }
        @supports not (container-type: inline-size) {
          .chapter-book-prose img[data-fullbleed='true'] {
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            height: auto !important;
            float: none !important;
          }
        }
        .chapter-book-prose mark { background-color: #fde68a; padding: 0 2px; border-radius: 2px; }
      `}</style>
    </div>
  );
}

interface ActionTone {
  amber: string;
  green: string;
  pink: string;
  dark: string;
  blue: string;
}

const TONE_BG: ActionTone = {
  amber: 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200 border border-yellow-300',
  green: 'bg-green-600 text-white hover:bg-green-700',
  pink: 'bg-pink-600 text-white hover:bg-pink-700',
  dark: 'bg-gray-700 text-white hover:bg-gray-800',
  blue: 'bg-blue-600 text-white hover:bg-blue-700',
};

function ActionButton({
  tone,
  onClick,
  disabled,
  icon,
  label,
}: {
  tone: keyof ActionTone;
  onClick: () => void;
  disabled?: boolean;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold transition-colors disabled:opacity-50 ${TONE_BG[tone]}`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function DisabledAction({
  tone,
  icon,
  label,
  tooltip,
}: {
  tone: keyof ActionTone;
  icon: string;
  label: string;
  tooltip: string;
}) {
  return (
    <button
      type="button"
      disabled
      title={tooltip}
      aria-label={`${label} — ${tooltip}`}
      className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold opacity-40 cursor-not-allowed ${TONE_BG[tone]}`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
