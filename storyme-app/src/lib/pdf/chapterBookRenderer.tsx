/**
 * Chapter book PDF renderer.
 *
 * Walks the Tiptap doc JSON and maps each block type to react-pdf
 * primitives. Page-break nodes start a new <Page>; everything else
 * flows on the current page (react-pdf auto-paginates if a single
 * segment overflows).
 *
 * Why a separate renderer rather than reusing the picture-book
 * templates: chapter books are flowing text + occasional images, with
 * no scenes or layouts to choose from. The picture-book templates' 1/2/4
 * scenes-per-page concept doesn't translate.
 *
 * Inline marks (bold/italic/underline) are rendered as nested <Text>
 * runs since react-pdf supports inline styles only via nested Text.
 */

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image as PdfImage,
  StyleSheet,
  Font,
  pdf,
} from '@react-pdf/renderer';
import type { JSONContent } from '@tiptap/react';

// Register the same fonts the editor + web reader use, so a PDF export
// looks like the kid's screen — not Times-Roman regardless of font
// choice. The TTFs live in /public/fonts/ (also referenced by globals.css's
// @font-face block). Registration is idempotent across hot-reloads.
//
// Why an absolute URL: react-pdf's Font.register fetches at render
// time. In the browser, a relative `/fonts/...` path resolves against
// document.location and works. The check below guards against any
// unexpected SSR call so fontkit doesn't crash before window exists.
const FONT_BASE =
  typeof window !== 'undefined' ? `${window.location.origin}/fonts` : '/fonts';

let fontsRegistered = false;
function registerChapterBookFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: 'Lora',
    fonts: [
      { src: `${FONT_BASE}/Lora-Regular.ttf` },
      { src: `${FONT_BASE}/Lora-Bold.ttf`, fontWeight: 700 },
      { src: `${FONT_BASE}/Lora-Italic.ttf`, fontStyle: 'italic' },
      { src: `${FONT_BASE}/Lora-BoldItalic.ttf`, fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  Font.register({
    family: 'Comic Neue',
    fonts: [
      { src: `${FONT_BASE}/ComicNeue-Regular.ttf` },
      { src: `${FONT_BASE}/ComicNeue-Bold.ttf`, fontWeight: 700 },
      { src: `${FONT_BASE}/ComicNeue-Italic.ttf`, fontStyle: 'italic' },
      { src: `${FONT_BASE}/ComicNeue-BoldItalic.ttf`, fontWeight: 700, fontStyle: 'italic' },
    ],
  });
  fontsRegistered = true;
}

// Editor font-stack → react-pdf font-family. The editor stores the
// full CSS stack on textStyle.fontFamily marks (see ChapterBookEditor's
// FONT_FAMILIES). react-pdf only knows family names, so we sniff the
// stack and pick the canonical one. Unknown stacks fall through to
// Helvetica (built-in sans), matching the editor's "Clean" preset.
function pickPdfFontFamily(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  if (/Lora/i.test(stack)) return 'Lora';
  if (/Comic Neue|Comic Sans/i.test(stack)) return 'Comic Neue';
  if (/monospace|Courier/i.test(stack)) return 'Courier';
  if (/sans-serif|system-ui/i.test(stack)) return 'Helvetica';
  return undefined;
}

// CSS px → PDF pt scale factor. The editor stores image widths in CSS
// pixels (1 px = 1/96 in), react-pdf measures in points (1 pt = 1/72 in).
// Without this conversion, a kid's 280-px image renders at 280 pt =
// 373 CSS-px-equivalent on the printed page — roughly 1.33× larger than
// what they saw in the editor.
const CSS_PX_TO_PDF_PT = 72 / 96; // 0.75

const styles = StyleSheet.create({
  page: {
    // Tightened from 56pt all around so typical 10-page kid stories fit
    // their chapter-book pageBreaks 1:1 against PDF pages instead of
    // spilling across multiple PDF pages.
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 36,
    // Lora is the editor's default body font ("Storybook"); matching
    // it here means an unmarked-up doc renders the same on screen and
    // in the PDF. Marks on individual runs override this per-Text below.
    fontFamily: 'Lora',
    // Editor body is 20 CSS px ≈ 15 pt — we slot just under that to
    // leave headroom on smaller PDF page sizes (a5) while staying
    // readable on `large`. Per-mark fontSize overrides still apply.
    fontSize: 13,
    lineHeight: 1.55,
    color: '#1f2937',
  },
  h1: {
    fontSize: 26,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 12,
  },
  h2: {
    fontSize: 18,
    fontWeight: 700,
    marginTop: 14,
    marginBottom: 6,
  },
  paragraph: {
    marginVertical: 4,
  },
  bullet: {
    flexDirection: 'row',
    marginVertical: 2,
  },
  bulletDot: {
    width: 14,
  },
  bulletBody: {
    flex: 1,
  },
  image: {
    marginVertical: 10,
    borderRadius: 4,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    color: '#9ca3af',
  },
  // Tier 2 approximate text-wrap: image + adjacent paragraphs sit in a
  // flex row so we get one "block" of wrap-around for free, mirroring
  // the editor's float behavior. react-pdf can't actually flow text
  // around a float, so this only fakes wrap for the leading paragraphs;
  // anything beyond resumes full width below.
  floatRow: {
    flexDirection: 'row',
    marginVertical: 10,
  },
  floatRowImage: {
    borderRadius: 4,
  },
  floatRowText: {
    flex: 1,
  },
});

/** Page sizes mirror the picture-book PDFFormat values so the existing
    ExportPdfModal can drive both renderers with the same vocabulary.
    'large' uses the same 504×612 (7"×8.5") size as the picture-book
    'large' template — slightly bigger than A5 for a roomier print. */
export type ChapterBookPdfFormat = 'a5' | 'a4' | 'large';

const PAGE_SIZE_MAP: Record<ChapterBookPdfFormat, 'A5' | 'A4' | [number, number]> = {
  a5: 'A5',
  a4: 'A4',
  large: [504, 612],
};

interface RenderOptions {
  title: string | null;
  authorName?: string | null;
  format?: ChapterBookPdfFormat;
}

/**
 * Build the react-pdf <Document> for a chapter book.
 */
function ChapterBookPdf({
  doc,
  options,
}: {
  doc: JSONContent | null;
  options: RenderOptions;
}) {
  const pages = splitDocByPageBreaks(doc);
  // Default to `large` (504×612pt) — gives chapter-book pages enough
  // vertical room that a typical "image + a few paragraphs" page lands
  // on one PDF page instead of spilling. Callers can still pick a5/a4.
  const size = PAGE_SIZE_MAP[options.format ?? 'large'];

  return (
    <Document title={options.title ?? 'Chapter Book'}>
      {pages.map((pageDoc, idx) => (
        <Page key={idx} size={size} style={styles.page}>
          {renderPageBlocks(pageDoc.content ?? [])}
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            fixed
          />
        </Page>
      ))}
    </Document>
  );
}

/**
 * Walk a page's top-level nodes, grouping a left/right-aligned image
 * with the up-to-N paragraphs that follow it into a flex-row "float
 * row". This is the Tier 2 approximation of CSS float in a renderer
 * that has no real float support — kids see image-beside-paragraph
 * the same way they would in a book.
 *
 * Why N is capped: react-pdf can't measure image height in advance,
 * so we can't know when the paragraphs have "outgrown" the image. A
 * cap of 3 paragraphs keeps the column from staying narrow forever
 * when a kid writes a long stretch of text. After the cap (or any
 * non-paragraph block), remaining content flows full-width below.
 */
const MAX_PARAGRAPHS_BESIDE_IMAGE = 3;

function renderPageBlocks(content: JSONContent[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < content.length) {
    const node = content[i];
    if (isFloatedSideImage(node)) {
      const paragraphs: JSONContent[] = [];
      let j = i + 1;
      while (
        j < content.length &&
        content[j].type === 'paragraph' &&
        paragraphs.length < MAX_PARAGRAPHS_BESIDE_IMAGE
      ) {
        paragraphs.push(content[j]);
        j += 1;
      }
      if (paragraphs.length > 0) {
        out.push(<FloatRow key={i} image={node} paragraphs={paragraphs} />);
        i = j;
        continue;
      }
    }
    out.push(<RenderBlock key={i} node={node} />);
    i += 1;
  }
  return out;
}

function isFloatedSideImage(node: JSONContent): boolean {
  if (node.type !== 'image') return false;
  if (node.attrs?.fullBleed) return false;
  const align = node.attrs?.align;
  return align === 'left' || align === 'right';
}

function FloatRow({
  image,
  paragraphs,
}: {
  image: JSONContent;
  paragraphs: JSONContent[];
}) {
  const align = (image.attrs?.align as string) || 'left';
  const isLeft = align === 'left';
  const widthAttr = image.attrs?.width as string | undefined;
  const m = widthAttr ? /^(\d+(?:\.\d+)?)px$/.exec(widthAttr) : null;
  // Fall back to a sensible default if the kid never resized the image.
  const imgWidthPt = m ? Number(m[1]) * CSS_PX_TO_PDF_PT : 180;
  const src = image.attrs?.src as string | undefined;
  if (!src) {
    return <>{paragraphs.map((p, i) => <RenderBlock key={i} node={p} />)}</>;
  }

  const imgBlock = (
    <PdfImage
      src={src}
      style={[styles.floatRowImage, { width: imgWidthPt }]}
    />
  );
  const textBlock = (
    <View style={styles.floatRowText}>
      {paragraphs.map((p, i) => <RenderBlock key={i} node={p} />)}
    </View>
  );

  return (
    <View style={styles.floatRow}>
      {isLeft ? (
        <>
          <View style={{ marginRight: 12 }}>{imgBlock}</View>
          {textBlock}
        </>
      ) : (
        <>
          {textBlock}
          <View style={{ marginLeft: 12 }}>{imgBlock}</View>
        </>
      )}
    </View>
  );
}

/** Map a top-level Tiptap block to a react-pdf element. */
function RenderBlock({ node }: { node: JSONContent }) {
  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) ?? 1;
      const style = level === 1 ? styles.h1 : styles.h2;
      const align = (node.attrs?.textAlign as string | undefined) || undefined;
      return (
        <Text style={[style, align ? { textAlign: align as 'left' | 'center' | 'right' } : {}]}>
          {renderInline(node.content)}
        </Text>
      );
    }
    case 'paragraph': {
      const align = (node.attrs?.textAlign as string | undefined) || undefined;
      return (
        <Text style={[styles.paragraph, align ? { textAlign: align as 'left' | 'center' | 'right' } : {}]}>
          {renderInline(node.content) || ' '}
        </Text>
      );
    }
    case 'bulletList':
    case 'orderedList': {
      const items = node.content ?? [];
      return (
        <View>
          {items.map((item, i) => (
            <View key={i} style={styles.bullet}>
              <Text style={styles.bulletDot}>
                {node.type === 'orderedList' ? `${i + 1}.` : '•'}
              </Text>
              <View style={styles.bulletBody}>
                {(item.content ?? []).map((child, ci) => (
                  <RenderBlock key={ci} node={child} />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    }
    case 'blockquote': {
      const inner = node.content ?? [];
      return (
        <View
          style={{
            borderLeftWidth: 2,
            borderLeftColor: '#9ca3af',
            paddingLeft: 8,
            marginVertical: 8,
          }}
        >
          {inner.map((child, i) => (
            <RenderBlock key={i} node={child} />
          ))}
        </View>
      );
    }
    case 'image': {
      const src = node.attrs?.src as string | undefined;
      if (!src) return null;
      // Full-bleed images stretch to the page content width. Otherwise
      // honor the kid's pixel width from the corner-drag handle —
      // converted px → pt so the printed size visually matches the
      // editor (see CSS_PX_TO_PDF_PT note above).
      const fullBleed = !!node.attrs?.fullBleed;
      const widthAttr = node.attrs?.width as string | undefined;
      const widthStyle: { width?: number | string } = {};
      if (fullBleed) {
        widthStyle.width = '100%';
      } else if (widthAttr) {
        const m = /^(\d+(?:\.\d+)?)px$/.exec(widthAttr);
        if (m) widthStyle.width = Number(m[1]) * CSS_PX_TO_PDF_PT;
      }
      // Alignment maps to flex self-alignment within the page column.
      // Full-bleed images ignore align since they fill the row.
      const align = (node.attrs?.align as string) || 'center';
      const alignSelf = fullBleed
        ? 'stretch'
        : align === 'left' ? 'flex-start'
        : align === 'right' ? 'flex-end'
        : 'center';
      return (
        <PdfImage
          src={src}
          style={[styles.image, widthStyle, { alignSelf }]}
        />
      );
    }
    case 'horizontalRule':
      return <View style={{ borderBottomWidth: 1, borderColor: '#d1d5db', marginVertical: 12 }} />;
    case 'pageBreak':
      return null;
    default:
      return node.content ? (
        <Text style={styles.paragraph}>{renderInline(node.content)}</Text>
      ) : null;
  }
}

/**
 * Render a Tiptap inline content array to nested <Text> runs.
 * Marks compose via style props:
 *   - bold / italic / underline / strike: glyph styling
 *   - textStyle: font-size + color + font-family. fontFamily is mapped
 *     from the editor's CSS stack (e.g. 'Lora, Georgia, serif') down
 *     to the canonical family name react-pdf knows about (Lora /
 *     Comic Neue / Helvetica / Courier).
 *   - highlight: yellow background
 */
function renderInline(content: JSONContent[] | undefined): React.ReactNode {
  if (!content) return null;
  return content.map((node, i) => {
    if (node.type === 'text') {
      const style: Record<string, string | number> = {};
      const marks = node.marks ?? [];
      for (const mark of marks) {
        if (mark.type === 'bold') style.fontWeight = 700;
        if (mark.type === 'italic') style.fontStyle = 'italic';
        if (mark.type === 'underline') {
          // Compose with strike if both are present.
          style.textDecoration = style.textDecoration
            ? `${style.textDecoration} underline`
            : 'underline';
        }
        if (mark.type === 'strike') {
          style.textDecoration = style.textDecoration
            ? `${style.textDecoration} line-through`
            : 'line-through';
        }
        if (mark.type === 'textStyle') {
          const attrs = (mark.attrs ?? {}) as {
            fontSize?: string;
            color?: string;
            fontFamily?: string;
          };
          if (attrs.fontSize) {
            const m = /^(\d+(?:\.\d+)?)px$/.exec(attrs.fontSize);
            if (m) {
              // Map editor sizes (16/20/26 px) to PDF point sizes,
              // anchored to the body baseline of 12pt = 16px so rendering
              // tracks the editor's relative scale.
              style.fontSize = (Number(m[1]) / 16) * 12;
            }
          }
          if (attrs.color) style.color = attrs.color;
          if (attrs.fontFamily) {
            const family = pickPdfFontFamily(attrs.fontFamily);
            if (family) style.fontFamily = family;
          }
        }
        if (mark.type === 'highlight') {
          // react-pdf doesn't support text background-color natively, but
          // a colored Text wrapper still highlights the glyphs. Rendered
          // as a yellow tinted background by way of `backgroundColor`.
          style.backgroundColor = '#fde68a';
        }
      }
      return (
        <Text key={i} style={Object.keys(style).length ? style : undefined}>
          {node.text ?? ''}
        </Text>
      );
    }
    if (node.type === 'hardBreak') {
      return <Text key={i}>{'\n'}</Text>;
    }
    return null;
  });
}

/**
 * Split top-level doc content on pageBreak nodes. Identical logic to the
 * reader's splitter — the contract that a `pageBreak` ends one page and
 * starts the next is the only thing kids can rely on.
 */
function splitDocByPageBreaks(doc: JSONContent | null): JSONContent[] {
  if (!doc || !Array.isArray(doc.content)) return [{ type: 'doc', content: [] }];
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
  return pages.length ? pages : [{ type: 'doc', content: [] }];
}

/**
 * Pre-fetch every image referenced in the doc and rewrite its `src` to
 * an embedded base64 data URL.
 *
 * Why: react-pdf renders in the browser via `pdf().toBlob()` and fetches
 * image URLs at render time. CORS quirks, redirect chains, or transient
 * fetch failures cause images to silently drop out of the PDF (the
 * renderer doesn't propagate per-image errors). Embedding as data URLs
 * is bulletproof — once the bytes are in memory, react-pdf can't fail
 * to load them.
 *
 * Cost: O(images) extra fetches. Cached behind a Map so duplicate URLs
 * (e.g. the same character used twice) only fetch once. Per-image
 * failures fall back to leaving the URL as-is so a broken image doesn't
 * fail the whole export.
 */
async function preloadImages(doc: JSONContent | null): Promise<JSONContent | null> {
  if (!doc) return doc;
  const cache = new Map<string, string>();

  async function toDataUrl(url: string): Promise<string> {
    if (cache.has(url)) return cache.get(url)!;
    if (url.startsWith('data:')) {
      cache.set(url, url);
      return url;
    }
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
      const blob = await res.blob();
      // react-pdf only handles JPEG / PNG / GIF — it throws "Base64 image
      // invalid format: webp" on a WebP data URL. The image generation
      // pipeline (and several Supabase storage uploads) emit WebP for
      // size, so we transcode here at PDF-build time. Browsers can
      // decode WebP into a canvas, then we re-encode the canvas as PNG.
      const isWebP = blob.type === 'image/webp' || /\.webp(\?|$)/i.test(url);
      const finalBlob = isWebP ? await transcodeBlobToPng(blob) : blob;

      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(finalBlob);
      });
      cache.set(url, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[chapterBookPDF] image preload failed for', url, err);
      cache.set(url, url); // fall through with original URL
      return url;
    }
  }

  async function transcodeBlobToPng(blob: Blob): Promise<Blob> {
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('webp decode failed'));
        i.src = objectUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas 2d context unavailable');
      ctx.drawImage(img, 0, 0);
      const png: Blob | null = await new Promise((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      if (!png) throw new Error('webp → png re-encode produced empty blob');
      return png;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function walk(node: JSONContent): Promise<JSONContent> {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') {
      const next = { ...node, attrs: { ...node.attrs } };
      next.attrs.src = await toDataUrl(node.attrs.src as string);
      return next;
    }
    if (Array.isArray(node.content)) {
      const nextContent: JSONContent[] = [];
      for (const child of node.content) {
        nextContent.push(await walk(child));
      }
      return { ...node, content: nextContent };
    }
    return node;
  }

  return walk(doc);
}

/**
 * Public entry: build the PDF as a Blob. Preloads every image in the
 * doc to a data URL first so render-time CORS / fetch failures can't
 * silently drop pictures from the PDF.
 */
export async function generateChapterBookPDF(
  doc: JSONContent | null,
  options: RenderOptions
): Promise<Blob> {
  registerChapterBookFonts();
  const inlinedDoc = await preloadImages(doc);
  return pdf(<ChapterBookPdf doc={inlinedDoc} options={options} />).toBlob();
}

/**
 * Convenience wrapper: build + download in one step.
 */
export async function downloadChapterBookPDF(
  doc: JSONContent | null,
  options: RenderOptions
): Promise<void> {
  const blob = await generateChapterBookPDF(doc, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeTitle = (options.title ?? 'chapter-book').replace(/[\\/:*?"<>|]/g, '_');
  link.download = `${safeTitle}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
