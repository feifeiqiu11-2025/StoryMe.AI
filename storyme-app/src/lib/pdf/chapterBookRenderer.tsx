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
  pdf,
} from '@react-pdf/renderer';
import type { JSONContent } from '@tiptap/react';

// react-pdf ships Times/Helvetica/Courier built-in; Times-Roman is our
// chapter-book default. If we ever ship a custom serif via /public/fonts,
// register it here with Font.register.

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
    fontFamily: 'Times-Roman',
    fontSize: 12,
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
    bottom: 30,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 10,
    color: '#9ca3af',
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
  const size = PAGE_SIZE_MAP[options.format ?? 'a5'];

  return (
    <Document title={options.title ?? 'Chapter Book'}>
      {pages.map((pageDoc, idx) => (
        <Page key={idx} size={size} style={styles.page}>
          {(pageDoc.content ?? []).map((node, i) => (
            <RenderBlock key={i} node={node} />
          ))}
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
      // honor the kid's pixel width from the corner-drag handle.
      const fullBleed = !!node.attrs?.fullBleed;
      const widthAttr = node.attrs?.width as string | undefined;
      const widthStyle: { width?: number | string } = {};
      if (fullBleed) {
        widthStyle.width = '100%';
      } else if (widthAttr) {
        const m = /^(\d+(?:\.\d+)?)px$/.exec(widthAttr);
        if (m) widthStyle.width = Number(m[1]);
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
 *   - textStyle: font-size + color (font-family skipped — react-pdf
 *     requires Font.register'd fonts; we don't bundle Lora/Comic so we
 *     fall back to the page-level Times-Roman)
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
          const attrs = (mark.attrs ?? {}) as { fontSize?: string; color?: string };
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
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      cache.set(url, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('[chapterBookPDF] image preload failed for', url, err);
      cache.set(url, url); // fall through with original URL
      return url;
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
