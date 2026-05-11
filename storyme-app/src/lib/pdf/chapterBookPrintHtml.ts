/**
 * Builds the full print HTML document for a chapter book.
 *
 * Pure function: takes the project + Tiptap doc + page format, returns
 * a complete HTML string that Chromium can render via page.setContent().
 * No React, no Tiptap NodeView runtime — we reuse the same docToPages
 * helper that the public mobile API uses to convert canvas_state into
 * per-page HTML chunks, then wrap them in print-aware CSS.
 *
 * Why this lives separately from the API route: it's pure, easily
 * testable, and `?debug=html` on the PDF route can return it raw for
 * iterating on the print stylesheet in a browser without spinning up
 * headless Chromium each time.
 */

import { docToPages, type ChapterBookPage } from '@/lib/chapter-book/docToPages';

export type ChapterBookPdfFormat = 'a5' | 'a4' | 'large' | 'letter';

interface BuildInput {
  /** Public deploy origin used to resolve absolute /fonts/ URLs from
   *  inside the setContent HTML (which has no base URL). */
  origin: string;
  title: string | null;
  authorName: string | null;
  canvasState: Record<string, unknown> | null;
  format: ChapterBookPdfFormat;
}

interface FormatGeometry {
  /** CSS `@page size` value */
  size: string;
  /** Outer margin for content (page-number footer is positioned in
   *  Chromium's print options, NOT inside this CSS, so we don't reserve
   *  space for it here — the page.pdf() margin option handles that). */
  margin: string;
}

const FORMATS: Record<ChapterBookPdfFormat, FormatGeometry> = {
  a5: { size: 'A5', margin: '14mm 16mm' },
  a4: { size: 'A4', margin: '16mm 20mm' },
  // 7" × 8.5" — matches the picture-book "large" template
  large: { size: '7in 8.5in', margin: '14mm 16mm' },
  // US Letter — the default for chapter books. Generous vertical room
  // so most kid-typical "cover + author info" pages fit on a single
  // PDF page without spillage.
  letter: { size: 'Letter', margin: '16mm 18mm' },
};

export function buildChapterBookPrintHtml(input: BuildInput): string {
  const pages = docToPages(input.canvasState);
  const fmt = FORMATS[input.format];
  const title = escapeHtml(input.title ?? 'Chapter Book');

  // Each chapter-book page becomes a <section.print-page>. CSS
  // page-break-after: always forces it to occupy its own PDF page.
  // The last page's page-break is suppressed so we don't get a
  // trailing blank PDF page.
  const pagesHtml = pages.length > 0
    ? pages.map((p) => renderPrintPage(p)).join('\n')
    : '<section class="print-page"><p class="print-empty">This book is empty.</p></section>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${title}</title>
<style>${printStylesheet(input.origin, fmt)}</style>
</head>
<body>
${pagesHtml}
</body>
</html>`;
}

function renderPrintPage(page: ChapterBookPage): string {
  return `<section class="print-page chapter-book-prose">${page.html}</section>`;
}

/**
 * The entire visual contract for the PDF lives in this stylesheet.
 *
 * Two big things to get right:
 *   1. `@page` controls paper size + printable margin. Chromium fills
 *      the space inside `@page` margins with the body content. The
 *      page-number footer that Chromium adds via headerTemplate /
 *      footerTemplate lives in the @page margin area itself, not in
 *      body content.
 *   2. `page-break-after: always` on each .print-page section forces
 *      a hard PDF page break between chapter-book pages, no matter
 *      how short the content. `break-inside: avoid` on images and
 *      headings prevents Chromium from slicing one across pages.
 *
 * The rest mirrors the web reader's typography so the PDF looks like
 * the screen.
 */
function printStylesheet(origin: string, fmt: FormatGeometry): string {
  const fontBase = `${origin}/fonts`;
  return `
/* Bundled chapter-book fonts. Absolute URLs because setContent HTML
   has no document base; Chromium will fetch these during the
   networkidle wait in the API handler. */
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 400;
  src: url('${fontBase}/Lora-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'Lora';
  font-style: normal;
  font-weight: 700;
  src: url('${fontBase}/Lora-Bold.ttf') format('truetype');
}
@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 400;
  src: url('${fontBase}/Lora-Italic.ttf') format('truetype');
}
@font-face {
  font-family: 'Lora';
  font-style: italic;
  font-weight: 700;
  src: url('${fontBase}/Lora-BoldItalic.ttf') format('truetype');
}
@font-face {
  font-family: 'Comic Neue';
  font-style: normal;
  font-weight: 400;
  src: url('${fontBase}/ComicNeue-Regular.ttf') format('truetype');
}
@font-face {
  font-family: 'Comic Neue';
  font-style: normal;
  font-weight: 700;
  src: url('${fontBase}/ComicNeue-Bold.ttf') format('truetype');
}
@font-face {
  font-family: 'Comic Neue';
  font-style: italic;
  font-weight: 400;
  src: url('${fontBase}/ComicNeue-Italic.ttf') format('truetype');
}
@font-face {
  font-family: 'Comic Neue';
  font-style: italic;
  font-weight: 700;
  src: url('${fontBase}/ComicNeue-BoldItalic.ttf') format('truetype');
}

@page {
  size: ${fmt.size};
  margin: ${fmt.margin};
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: white;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-family: 'Lora', Georgia, 'Times New Roman', serif;
  /* Body 13pt (down from 14pt) reclaims ~10% vertical space per page
     so chapter-book pages with image + several paragraphs are more
     likely to fit a single PDF page without spilling. */
  font-size: 13pt;
  line-height: 1.55;
  color: #1f2937;
}

.print-page {
  /* One chapter-book page == one PDF page. */
  page-break-after: always;
  break-after: page;
  /* Reset float context so a floated image on page N doesn't bleed
     into page N+1's layout. */
  overflow: hidden;
}
.print-page:last-child {
  page-break-after: auto;
  break-after: auto;
}

/* Empty-book fallback. */
.print-empty {
  text-align: center;
  color: #9ca3af;
  font-style: italic;
  margin-top: 2em;
}

/* Typography (mirrors ChapterBookReader). */
.chapter-book-prose h1 {
  font-size: 2.1em;
  font-weight: 700;
  margin: 0.5em 0 0.35em;
  line-height: 1.2;
  break-after: avoid;
  page-break-after: avoid;
}
.chapter-book-prose h2 {
  font-size: 1.5em;
  font-weight: 700;
  margin: 0.8em 0 0.35em;
  line-height: 1.25;
  break-after: avoid;
  page-break-after: avoid;
}
.chapter-book-prose p {
  margin: 0.55em 0;
  /* Keep paragraphs intact across page breaks where possible. */
  orphans: 3;
  widows: 3;
}
.chapter-book-prose ul,
.chapter-book-prose ol {
  margin: 0.55em 0;
  padding-left: 1.5em;
}
.chapter-book-prose ul { list-style-type: disc; }
.chapter-book-prose ol { list-style-type: decimal; }
.chapter-book-prose li { margin: 0.2em 0; }
.chapter-book-prose blockquote {
  border-left: 3px solid #9ca3af;
  padding-left: 0.8em;
  margin: 0.8em 0;
  color: #4b5563;
  font-style: italic;
  break-inside: avoid;
  page-break-inside: avoid;
}
.chapter-book-prose mark {
  background-color: #fde68a;
  padding: 0 2px;
  border-radius: 2px;
}
.chapter-book-prose hr {
  border: 0;
  border-top: 1px solid #d1d5db;
  margin: 1em 0;
}

/* First/last child margin reset — same trick as the reader, keeps
   the cover image / opening text flush to the top of the print page. */
.chapter-book-prose > *:first-child { margin-top: 0 !important; }
.chapter-book-prose > *:last-child { margin-bottom: 0 !important; }

/* Image layout — this is the entire reason we switched to Chromium:
   real CSS float gives proper text wrap around floated images. */
.chapter-book-prose img {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  display: block;
  break-inside: avoid;
  page-break-inside: avoid;
}
.chapter-book-prose img[data-align='center'],
.chapter-book-prose img:not([data-align]) {
  margin: 0.6em auto;
}
.chapter-book-prose img[data-align='left'] {
  float: left;
  margin: 0.2em 1em 0.5em 0;
  clear: left;
}
.chapter-book-prose img[data-align='right'] {
  float: right;
  margin: 0.2em 0 0.5em 1em;
  clear: right;
}

/* Full-bleed cover images: stretch toward the page edge while
   ALSO honoring a height cap so trailing content (author, copyright,
   first paragraph) has room on the same PDF page. Without the cap,
   a near-square cover at full bleed eats the entire page.
   - max-width: calc(100% + 32mm) -> would bleed past content margins
     when image is naturally wide enough.
   - max-height: 75vh -> never exceed 75% of the PDF page height,
     leaving ~25% for trailing content.
   - width/height auto -> preserve natural aspect ratio; browser
     picks the largest size that fits both maxes. */
.chapter-book-prose img[data-fullbleed='true'] {
  display: block;
  width: auto;
  height: auto;
  max-width: calc(100% + 32mm);
  max-height: 75vh;
  margin: 0 auto 0.6em;
  border-radius: 0;
  float: none;
}

/* Inline text styling from textStyle marks (color/font-size/font-family)
   is set inline on <span style="..."> by docToPages — nothing extra
   needed here. */
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
