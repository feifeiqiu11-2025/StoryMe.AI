/**
 * ChapterBookReader — paginated viewer for a chapter_book project.
 *
 * Splits the Tiptap doc on pageBreak nodes, renders one page at a time
 * with prev/next nav. Reuses the same Lora-serif typography as the
 * editor so what kids wrote is what readers see.
 *
 * Why HTML render instead of mounting Tiptap read-only: the reader has
 * no editing surface, and mounting Tiptap pulls in the full ProseMirror
 * runtime for nothing. The doc's renderHTML output (sanitized via
 * isomorphic-dompurify) is enough.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'isomorphic-dompurify';
import { generateHTML, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { PageBreak } from './extensions/PageBreakNode';
import { FontSize } from './extensions/FontSizeMark';
// Use the editor's image extension here too so width + data-align attrs
// round-trip through generateHTML(). The default @tiptap/extension-image
// only knows about src/alt/title and would silently drop alignment + size.
import { ResizableImage } from './extensions/ResizableImage';

interface ChapterBookReaderProps {
  title: string | null;
  authorName?: string | null;
  doc: JSONContent | null;
  /** Click handler for the "Exit Reading Mode" button. Caller decides
      where to route (owner → details page, public viewer → community
      feed, etc). When omitted, the button is hidden. */
  onExit?: () => void;
}

export function ChapterBookReader({ title, authorName, doc, onExit }: ChapterBookReaderProps) {
  const [pageIndex, setPageIndex] = useState(0);

  // Split the doc into pages on every pageBreak block. Empty doc → one
  // page so the reader still renders cleanly.
  const pages = useMemo(() => splitDocByPageBreaks(doc), [doc]);
  const totalPages = Math.max(pages.length, 1);

  // Clamp index when doc changes (rare but handles late hydration).
  useEffect(() => {
    if (pageIndex >= totalPages) setPageIndex(0);
  }, [totalPages, pageIndex]);

  const currentPageHtml = useMemo(() => {
    const pageDoc = pages[pageIndex] ?? { type: 'doc', content: [] };
    try {
      const html = generateHTML(pageDoc as JSONContent, [
        StarterKit,
        ResizableImage,
        Underline,
        TextStyle,
        Color,
        FontFamily,
        FontSize,
        TextAlign,
        Highlight,
        PageBreak,
      ]);
      return DOMPurify.sanitize(html, {
        // Allow image tags + standard typographic markup. dompurify's
        // default config already blocks scripts/iframes/event handlers.
        ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'strong', 'em', 'u', 's', 'br',
          'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'hr', 'img', 'a', 'span', 'mark', 'div'],
        ALLOWED_ATTR: ['src', 'alt', 'title', 'href', 'target', 'rel', 'class', 'style', 'data-align', 'data-fullbleed'],
      });
    } catch (err) {
      console.error('Failed to render chapter-book page:', err);
      return '<p class="text-red-600">Could not render this page.</p>';
    }
  }, [pages, pageIndex]);

  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));
  const goNext = () => setPageIndex((i) => Math.min(totalPages - 1, i + 1));

  // Keyboard nav: arrow keys advance pages.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-2 sm:py-3">
        {/* Header strip — tight to the top. "Exit Reading Mode" button
            on the left (clearer than a bare X — kids could mistake X
            for delete), title on the right. */}
        <div className="mb-2 flex items-center justify-between gap-3">
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-md flex-shrink-0"
              aria-label="Exit reading mode"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Exit Reading Mode</span>
            </button>
          ) : <span />}
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">
              {title || 'Chapter Book'}
            </h1>
            {authorName && (
              <span className="text-xs text-gray-500 italic flex-shrink-0">by {authorName}</span>
            )}
          </div>
        </div>

        {/* Page surface — generous floor so the pager mostly sits in
            the same place page-to-page, but the page itself can grow
            past the floor for an occasional long page. Trade-off
            accepted to keep the scroll bar off the screen.
            container-type: inline-size lets full-bleed images stretch
            to this article's width (escaping the prose column). */}
        <article
          className="bg-white border border-gray-200 rounded-xl shadow-sm min-h-[calc(100vh-180px)]"
          style={{ containerType: 'inline-size', containerName: 'editor-card' }}
          aria-label={`Page ${pageIndex + 1} of ${totalPages}`}
        >
          <div
            className="chapter-book-prose px-6 py-8 sm:px-12 sm:py-10 max-w-[680px] mx-auto"
            dangerouslySetInnerHTML={{ __html: currentPageHtml }}
          />
        </article>

        {/* Pager — sits in the same place every page because the article
            above is fixed-height. */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={goPrev}
            disabled={pageIndex === 0}
            className="min-h-[44px] min-w-[88px] px-4 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Previous page"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {pageIndex + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={pageIndex === totalPages - 1}
            className="min-h-[44px] min-w-[88px] px-4 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Next page"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Reader typography mirrors the editor for WYSIWYG fidelity. */}
      <style jsx global>{`
        .chapter-book-prose {
          font-family: 'Lora', Georgia, 'Times New Roman', serif;
          font-size: 20px;
          line-height: 1.7;
          color: #1f2937;
        }
        .chapter-book-prose h1 {
          font-size: 2.25rem;
          font-weight: 700;
          margin: 1.25rem 0 0.5rem;
          line-height: 1.2;
        }
        .chapter-book-prose h2 {
          font-size: 1.65rem;
          font-weight: 700;
          margin: 1.5rem 0 0.5rem;
          line-height: 1.25;
        }
        .chapter-book-prose p {
          margin: 0.75rem 0;
        }
        .chapter-book-prose ul {
          list-style-type: disc;
          padding-left: 1.75rem;
          margin: 0.75rem 0;
        }
        .chapter-book-prose ol {
          list-style-type: decimal;
          padding-left: 1.75rem;
          margin: 0.75rem 0;
        }
        .chapter-book-prose ul ul {
          list-style-type: circle;
        }
        .chapter-book-prose ul ul ul {
          list-style-type: square;
        }
        .chapter-book-prose li {
          margin: 0.25rem 0;
        }
        .chapter-book-prose li > p {
          margin: 0;
        }
        /* The editor stores image alignment as data-align on the rendered
           wrapper; the reader receives just the <img> tag, so float
           rules target the image's data-align attribute directly. */
        .chapter-book-prose img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          display: block;
        }
        .chapter-book-prose img[data-align='center'],
        .chapter-book-prose img:not([data-align]) {
          margin: 1rem auto;
        }
        .chapter-book-prose img[data-align='left'] {
          float: left;
          margin: 0.25rem 1.25rem 0.5rem 0;
          clear: left;
        }
        .chapter-book-prose img[data-align='right'] {
          float: right;
          margin: 0.25rem 0 0.5rem 1.25rem;
          clear: right;
        }
        /* Full-bleed declared LAST + !important so it overrides any
           data-align float/margin state. */
        @container editor-card (min-width: 1px) {
          .chapter-book-prose img[data-fullbleed='true'] {
            width: 100cqi !important;
            max-width: none !important;
            margin-left: calc((100% - 100cqi) / 2) !important;
            margin-right: calc((100% - 100cqi) / 2) !important;
            margin-top: 1rem !important;
            margin-bottom: 1rem !important;
            float: none !important;
            display: block !important;
          }
        }
        @supports not (container-type: inline-size) {
          .chapter-book-prose img[data-fullbleed='true'] {
            width: 880px !important;
            max-width: 90vw !important;
            margin-left: auto !important;
            margin-right: auto !important;
            float: none !important;
          }
        }
        /* Floats clear only at page boundaries — see editor CSS for why. */
        .chapter-book-prose .chapter-book-page-break {
          clear: both;
        }
        .chapter-book-prose blockquote {
          border-left: 3px solid #9ca3af;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #4b5563;
          font-style: italic;
        }
        .chapter-book-prose mark {
          background-color: #fde68a;
          padding: 0 2px;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

/**
 * Walk the doc's top-level content. Each pageBreak ends the current page
 * and starts a new one. Atom blocks like pageBreak don't carry content;
 * we drop them — the visual page-break belongs in the editor, not the
 * reader (the page IS the break).
 */
function splitDocByPageBreaks(doc: JSONContent | null): JSONContent[] {
  if (!doc || !Array.isArray(doc.content)) {
    return doc ? [doc] : [];
  }
  const pages: JSONContent[] = [];
  let current: JSONContent[] = [];
  for (const node of doc.content) {
    if (node.type === 'pageBreak') {
      pages.push({ type: 'doc', content: current });
      current = [];
      continue;
    }
    current.push(node);
  }
  pages.push({ type: 'doc', content: current });
  // Drop trailing empty pages (kid hit "new page" but didn't write anything).
  while (pages.length > 1) {
    const last = pages[pages.length - 1];
    const empty =
      !last.content ||
      last.content.length === 0 ||
      last.content.every((n) => !n.content || n.content.length === 0);
    if (!empty) break;
    pages.pop();
  }
  return pages;
}
