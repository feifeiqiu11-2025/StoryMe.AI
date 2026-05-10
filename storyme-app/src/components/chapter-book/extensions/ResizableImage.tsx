/**
 * ResizableImage — extends Tiptap's Image with drag-to-resize, drag-to-
 * reposition, and left / center / right alignment (with text wrap).
 *
 * Storage:
 *   - width: inline pixel string ("320px") on attrs.width
 *   - align: 'left' | 'center' | 'right' on attrs.align (default 'center')
 * Both render as inline `style` on the <img> wrapper so the reader and
 * PDF renderer pick them up without extra plumbing.
 *
 * Drag-to-reposition: Image is draggable: true (inherited from the
 * official extension) and the NodeView wrapper carries data-drag-handle,
 * so ProseMirror's built-in drag/drop handles moving the image around
 * the doc.
 */

import Image from '@tiptap/extension-image';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';

const MIN_WIDTH = 80;
type Align = 'left' | 'center' | 'right';

function ImageNodeView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [draggingWidth, setDraggingWidth] = useState<number | null>(null);

  const src = node.attrs.src as string;
  const alt = (node.attrs.alt as string) || '';
  const storedWidth = node.attrs.width as string | null;
  const align = ((node.attrs.align as Align) || 'center') as Align;
  const fullBleed = !!node.attrs.fullBleed;

  // While dragging, ignore the fullBleed flag so the user sees their
  // size live; on release, we keep fullBleed false (drag turns it off).
  const renderedWidth = draggingWidth != null ? `${draggingWidth}px` : storedWidth || undefined;

  const onHandleDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const startX = e.clientX;
      const startWidth = wrapper.getBoundingClientRect().width;

      const onMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(MIN_WIDTH, startWidth + delta);
        setDraggingWidth(next);
      };
      const onUp = (ev: MouseEvent) => {
        const delta = ev.clientX - startX;
        const next = Math.max(MIN_WIDTH, startWidth + delta);
        // Drag commits a pixel width and clears fullBleed (the
        // explicit drag wins over the preset).
        updateAttributes({ width: `${Math.round(next)}px`, fullBleed: false });
        setDraggingWidth(null);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [updateAttributes]
  );

  const setSize = (pct: number) => {
    if (!wrapperRef.current) return;
    const parent = wrapperRef.current.parentElement;
    const cap = parent ? parent.clientWidth : 600;
    updateAttributes({ width: `${Math.round((cap * pct) / 100)}px`, fullBleed: false });
  };

  const setFullBleed = () => {
    // "Full" is special: instead of a fixed pixel width, we set a flag
    // so CSS container queries can stretch the image to the editor card
    // width (escaping the prose column). Stored as a separate attribute
    // so dragging the corner handle doesn't accidentally turn it on/off.
    updateAttributes({ width: null, fullBleed: true });
  };

  const setAlign = (a: Align) => {
    updateAttributes({ align: a });
  };

  // Float wrapping vs. block centering: float lets paragraphs after the
  // image wrap around it; center is a block element. CSS handles this
  // via the `data-align` and `data-fullbleed` attributes below.
  return (
    <NodeViewWrapper
      ref={wrapperRef}
      as="div"
      className={`chapter-book-image-wrapper ${selected ? 'is-selected' : ''}`}
      data-align={align}
      data-fullbleed={fullBleed ? 'true' : undefined}
      // Inline width is ignored when fullBleed is on — CSS container
      // queries take over and stretch the wrapper to the editor card.
      style={fullBleed ? undefined : { width: renderedWidth }}
      data-drag-handle
      draggable
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} draggable={false} />
      {selected && (
        <div className="chapter-book-image-controls" contentEditable={false}>
          {/* Size presets */}
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSize(33)} title="Small">
            S
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSize(66)} title="Medium">
            M
          </button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setSize(100)} title="Large (text column width)">
            L
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setFullBleed()}
            title="Full bleed — fills the page edge to edge (great for covers)"
            data-active={fullBleed}
            aria-pressed={fullBleed}
          >
            Full
          </button>
          <span className="chapter-book-image-controls-sep" aria-hidden />
          {/* Alignment */}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAlign('left')}
            title="Wrap left"
            data-active={align === 'left'}
            aria-pressed={align === 'left'}
          >
            ⫷
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAlign('center')}
            title="Center"
            data-active={align === 'center'}
            aria-pressed={align === 'center'}
          >
            ⊡
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setAlign('right')}
            title="Wrap right"
            data-active={align === 'right'}
            aria-pressed={align === 'right'}
          >
            ⫸
          </button>
        </div>
      )}
      {selected && (
        <div
          className="chapter-book-image-handle"
          onMouseDown={onHandleDown}
          role="presentation"
          aria-hidden
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.style.width || element.getAttribute('width') || null,
        renderHTML: (attributes: { width?: string | null }) => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}` };
        },
      },
      align: {
        default: 'center',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-align') || 'center',
        renderHTML: (attributes: { align?: Align }) => {
          if (!attributes.align) return {};
          return { 'data-align': attributes.align };
        },
      },
      fullBleed: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-fullbleed') === 'true',
        renderHTML: (attributes: { fullBleed?: boolean }) => {
          if (!attributes.fullBleed) return {};
          return { 'data-fullbleed': 'true' };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});
