/**
 * Server-side helper: convert a chapter-book Tiptap doc into a mobile-
 * friendly pages array.
 *
 * Why we don't reuse Tiptap's generateHTML on the server: importing the
 * editor's ResizableImage extension pulls in the React NodeViewWrapper
 * runtime, which we don't want in API routes. The translation we need
 * is small (a handful of node types), so doing it directly in TypeScript
 * keeps the API endpoint slim and keeps the editor stack out of server
 * bundles.
 *
 * Each page returns:
 *   - pageNumber:  1-based page index
 *   - html:        sanitized HTML for WebView-style mobile rendering
 *   - plainText:   text-only for TTS / accessibility / search
 *   - imageUrls:   ordered list of image src for native rendering
 *
 * If new node types are added to the editor and they should reach mobile,
 * extend renderBlock + extractText below.
 */

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

export interface ChapterBookPage {
  pageNumber: number;
  html: string;
  plainText: string;
  imageUrls: string[];
}

export function docToPages(doc: JsonNode | null | undefined): ChapterBookPage[] {
  if (!doc || !Array.isArray(doc.content)) return [];
  const pageBuckets: JsonNode[][] = [[]];
  for (const node of doc.content) {
    if (node.type === 'pageBreak') {
      pageBuckets.push([]);
      continue;
    }
    pageBuckets[pageBuckets.length - 1].push(node);
  }
  // Drop trailing empty pages
  while (pageBuckets.length > 1) {
    const last = pageBuckets[pageBuckets.length - 1];
    if (last.length === 0) {
      pageBuckets.pop();
    } else {
      break;
    }
  }
  return pageBuckets.map((nodes, i) => {
    const html = nodes.map(renderBlock).join('');
    const plainText = nodes.map(extractText).join('\n').trim();
    const imageUrls: string[] = [];
    collectImages(nodes, imageUrls);
    return {
      pageNumber: i + 1,
      html,
      plainText,
      imageUrls,
    };
  });
}

function renderBlock(node: JsonNode): string {
  switch (node.type) {
    case 'paragraph': {
      const align = (node.attrs?.textAlign as string) || '';
      const styleAttr = align ? ` style="text-align:${escapeAttr(align)}"` : '';
      return `<p${styleAttr}>${renderInline(node.content)}</p>`;
    }
    case 'heading': {
      const level = clampHeading(node.attrs?.level);
      const align = (node.attrs?.textAlign as string) || '';
      const styleAttr = align ? ` style="text-align:${escapeAttr(align)}"` : '';
      return `<h${level}${styleAttr}>${renderInline(node.content)}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${(node.content ?? []).map(renderBlock).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content ?? []).map(renderBlock).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content ?? []).map(renderBlock).join('')}</li>`;
    case 'blockquote':
      return `<blockquote>${(node.content ?? []).map(renderBlock).join('')}</blockquote>`;
    case 'horizontalRule':
      return '<hr>';
    case 'image': {
      const src = (node.attrs?.src as string) || '';
      const alt = (node.attrs?.alt as string) || '';
      const width = (node.attrs?.width as string) || '';
      const align = (node.attrs?.align as string) || '';
      const fullBleed = !!node.attrs?.fullBleed;
      if (!src) return '';
      // Full-bleed images don't carry an inline width — CSS container
      // queries on the rendering surface handle the stretch.
      const styleAttr = !fullBleed && width ? ` style="width:${escapeAttr(width)}"` : '';
      const dataAlign = align ? ` data-align="${escapeAttr(align)}"` : '';
      const dataFull = fullBleed ? ` data-fullbleed="true"` : '';
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${styleAttr}${dataAlign}${dataFull}>`;
    }
    case 'pageBreak':
    case 'hardBreak':
      return '<br>';
    case 'text':
      return renderInline([node]);
    default:
      return node.content ? `<p>${renderInline(node.content)}</p>` : '';
  }
}

function renderInline(content: JsonNode[] | undefined): string {
  if (!content) return '';
  return content
    .map((node) => {
      if (node.type === 'hardBreak') return '<br>';
      if (node.type !== 'text') return renderBlock(node);
      let text = escapeHtml(node.text ?? '');
      const marks = node.marks ?? [];
      // Apply marks from outside in: bold > italic > underline > strike >
      // textStyle > highlight. Each wraps the previous.
      const styles: string[] = [];
      for (const mark of marks) {
        if (mark.type === 'bold') text = `<strong>${text}</strong>`;
        else if (mark.type === 'italic') text = `<em>${text}</em>`;
        else if (mark.type === 'underline') text = `<u>${text}</u>`;
        else if (mark.type === 'strike') text = `<s>${text}</s>`;
        else if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
        else if (mark.type === 'textStyle') {
          const attrs = (mark.attrs ?? {}) as { fontSize?: string; color?: string; fontFamily?: string };
          if (attrs.fontSize) styles.push(`font-size:${escapeAttr(attrs.fontSize)}`);
          if (attrs.color) styles.push(`color:${escapeAttr(attrs.color)}`);
          if (attrs.fontFamily) styles.push(`font-family:${escapeAttr(attrs.fontFamily)}`);
        }
      }
      if (styles.length > 0) {
        text = `<span style="${styles.join(';')}">${text}</span>`;
      }
      return text;
    })
    .join('');
}

function extractText(node: JsonNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (!node.content) return '';
  return node.content.map(extractText).join(node.type === 'paragraph' || node.type?.startsWith('heading') ? '' : ' ');
}

function collectImages(nodes: JsonNode[], out: string[]): void {
  for (const node of nodes) {
    if (node.type === 'image') {
      const src = (node.attrs?.src as string) || '';
      if (src) out.push(src);
      continue;
    }
    if (node.content) collectImages(node.content, out);
  }
}

function clampHeading(level: unknown): 1 | 2 | 3 {
  const n = typeof level === 'number' ? level : 1;
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}
