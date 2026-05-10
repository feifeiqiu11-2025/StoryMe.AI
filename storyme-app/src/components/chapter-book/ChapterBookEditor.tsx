/**
 * ChapterBookEditor — Tiptap-based writer for chapter books (ages 7–12).
 *
 * Toolbar uses icon-based buttons (lucide-react) grouped into segments
 * separated by thin dividers. Designed to fit in a single horizontal
 * row at desktop widths and scroll on narrow viewports.
 *
 * Other features:
 *   - Auto-save (1.5s debounce) with visible "Saved" indicator
 *   - Word counter for the page the cursor is on, with a soft "page is
 *     getting long" hint when one page approaches A5/PDF capacity
 *   - Dismissable cover-page tip, only visible while the cursor is on page 1
 *   - Editor instance is published to parent on ready, so the MediaPanel
 *     can insert images without waiting for a toolbar click first
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useEditor, EditorContent, Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { FontFamily } from '@tiptap/extension-font-family';
import { ResizableImage } from './extensions/ResizableImage';
import { createPortal } from 'react-dom';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  FilePlus2,
  Undo2,
  Redo2,
  Type,
  Palette,
  CaseSensitive,
  X as XIcon,
} from 'lucide-react';
import { PageBreak } from './extensions/PageBreakNode';
import { FontSize, FONT_SIZES, type FontSizeKey } from './extensions/FontSizeMark';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ChapterBookEditorProps {
  bookId: string;
  initialDoc: JSONContent | null;
  /** Called once when the Tiptap instance is ready — used by the page so
      the MediaPanel can insert without waiting for a toolbar click. */
  onEditorReady?: (editor: Editor) => void;
  /** Live title from the parent's top-bar input; we save it on debounce. */
  title: string;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;
// A5 PDF page (Times-Roman 12pt, 56pt margins) holds ~250 words of body
// text comfortably. Soft warning at 220 leaves a little room before
// react-pdf has to break mid-paragraph.
const SOFT_WORDS_PER_PAGE = 220;

const TIP_DISMISSED_KEY = 'chapterBook.coverTipDismissed';

const COLOR_PALETTE: Array<{ value: string; label: string }> = [
  { value: '#1f2937', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#9333ea', label: 'Purple' },
];

export interface ChapterBookEditorHandle {
  /** Used by the page to expose save status to the top bar. */
  status: SaveStatus;
}

export function ChapterBookEditor({
  bookId,
  initialDoc,
  onEditorReady,
  title,
}: ChapterBookEditorProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');

  // Cursor is on page 1 initially. Updated on selection change so we can
  // hide the cover tip + scope the word counter.
  const [pageNumber, setPageNumber] = useState(1);
  const [pageWords, setPageWords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [tipDismissed, setTipDismissed] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTipDismissed(window.localStorage.getItem(TIP_DISMISSED_KEY) === '1');
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      ResizableImage.configure({ inline: false, allowBase64: false }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading' && node.attrs.level === 1) {
            return 'Title of your book…';
          }
          if (node.type.name === 'heading' && node.attrs.level === 2) {
            return 'Section title…';
          }
          return 'Start writing your story…';
        },
      }),
      Underline,
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: false }),
      PageBreak,
    ],
    content: initialDoc ?? undefined,
    immediatelyRender: false,
    // Re-render the React tree on every editor transaction so toolbar
    // active states (bold/italic/blockquote) and disabled flags
    // (undo/redo) stay in sync with the doc.
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          'chapter-book-prose focus:outline-none min-h-[70vh] max-w-[680px] mx-auto py-10 px-6 md:px-10',
        'aria-label': 'Chapter book editor',
      },
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // ── Page tracking (cursor-aware) ───────────────────────────────────
  useEffect(() => {
    if (!editor) return;
    const recompute = () => {
      const json = editor.getJSON();
      const sel = editor.state.selection;
      const cursor = sel.from;

      let total = 1;
      const blocks = json.content ?? [];
      for (const b of blocks) if (b.type === 'pageBreak') total += 1;
      setTotalPages(total);

      let pos = 1;
      let currentPage = 1;
      for (const block of blocks) {
        const blockSize = approxNodeSize(block);
        const blockEnd = pos + blockSize;
        if (cursor < blockEnd) break;
        if (block.type === 'pageBreak') currentPage += 1;
        pos = blockEnd;
      }
      setPageNumber(currentPage);

      let onTargetPage = false;
      let pageIdx = 1;
      const buf: string[] = [];
      for (const block of blocks) {
        if (block.type === 'pageBreak') {
          if (pageIdx === currentPage) break;
          pageIdx += 1;
          continue;
        }
        if (pageIdx === currentPage) {
          onTargetPage = true;
          buf.push(extractText(block));
        }
      }
      if (!onTargetPage) {
        setPageWords(0);
        return;
      }
      const text = buf.join(' ').trim();
      setPageWords(text ? text.split(/\s+/).length : 0);
    };

    recompute();
    editor.on('selectionUpdate', recompute);
    editor.on('update', recompute);
    return () => {
      editor.off('selectionUpdate', recompute);
      editor.off('update', recompute);
    };
  }, [editor]);

  // ── Auto-save (doc) ─────────────────────────────────────────────────
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const doSave = useCallback(
    async (payload: { editorDoc?: JSONContent; title?: string }) => {
      try {
        setSaveStatus('saving');
        const res = await fetch(`/api/v1/chapter-books/${bookId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Save failed (${res.status})`);
        setSaveStatus('saved');
      } catch (err) {
        console.error('Chapter book save failed:', err);
        setSaveStatus('error');
      }
    },
    [bookId]
  );

  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        doSave({ editorDoc: editor.getJSON() });
      }, AUTOSAVE_DEBOUNCE_MS);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editor, doSave]);

  // ── Title auto-save (title is owned by parent) ─────────────────────
  // We watch the title prop for changes and debounce a save; the parent
  // can also persist title changes itself if needed.
  const titleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedTitleRef = useRef(title);
  useEffect(() => {
    if (title === lastSavedTitleRef.current) return;
    if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    titleTimeoutRef.current = setTimeout(() => {
      lastSavedTitleRef.current = title;
      doSave({ title });
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (titleTimeoutRef.current) clearTimeout(titleTimeoutRef.current);
    };
  }, [title, doSave]);

  const dismissTip = useCallback(() => {
    setTipDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(TIP_DISMISSED_KEY, '1');
    }
  }, []);

  const showCoverTip = !tipDismissed && pageNumber === 1;
  const pageOverflow = pageWords >= SOFT_WORDS_PER_PAGE;

  // Render Toolbar inline (not memoized) so it picks up editor state on
  // every transaction — without this, isActive() / can().undo() never
  // refresh after first paint and buttons appear unresponsive.
  const toolbar = editor ? <Toolbar editor={editor} /> : null;

  return (
    // overflow-clip (not -hidden) so the sticky toolbar inside can pin to
    // the viewport while we still get rounded corners + an overflow guard
    // for embedded images. overflow:hidden would establish a scroll
    // container that confines `position: sticky`.
    //
    // container-type: inline-size + container-name lets full-bleed images
    // inside chapter-book-prose stretch to this card's width (escaping
    // the prose column's max-width: 680px).
    <div
      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-clip"
      style={{ containerType: 'inline-size', containerName: 'editor-card' }}
    >
      <SaveIndicatorPortal status={saveStatus} />

      {/* Sticky toolbar — visible at the top of the viewport while the
          editor body scrolls. z-10 keeps it above embedded images. */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        {toolbar}
      </div>

      {/* Page status bar */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
        <span>
          Page <span className="font-semibold text-gray-900">{pageNumber}</span> of {totalPages}
        </span>
        <span aria-hidden className="text-gray-300">·</span>
        <span className={pageOverflow ? 'text-amber-700 font-semibold' : ''}>
          {pageWords} words written here
        </span>
        {pageOverflow && (
          <span className="text-amber-700 hidden sm:inline">
            · This page is getting full — tap &ldquo;New Page&rdquo; to start the next one.
          </span>
        )}
      </div>

      {showCoverTip && (
        <div className="bg-amber-50 border-t border-amber-100 px-4 py-2.5 text-xs text-amber-800 flex items-start gap-2">
          <span className="flex-1">
            <span className="font-semibold">Tip:</span> Page 1 is your book cover! Put your
            title, your name, and a picture here. Other readers will see it on the community page.
          </span>
          <button
            type="button"
            onClick={dismissTip}
            aria-label="Dismiss tip"
            className="text-amber-700 hover:text-amber-900 leading-none p-0.5 rounded hover:bg-amber-100"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Paper-feel page surface */}
      <div className="bg-gradient-to-b from-gray-50 to-white">
        <EditorContent editor={editor} />
      </div>

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
        /* Tailwind preflight strips list-style; restore it for the
           editor body so bullets and numbers actually render. */
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
          margin: 0; /* avoid double spacing inside list items */
        }
        /* Resizable image wrapper — alignment via data-align attr.
           left/right use float so paragraphs after the image wrap around;
           center is a block centered with auto margins. max-width: none
           lets the kid drag past the prose column or hit Full bleed. */
        .chapter-book-image-wrapper {
          position: relative;
          max-width: none;
          cursor: grab;
        }
        .chapter-book-image-wrapper:active {
          cursor: grabbing;
        }
        .chapter-book-image-wrapper[data-align='center'] {
          display: block;
          margin: 1rem auto;
        }
        .chapter-book-image-wrapper[data-align='left'] {
          float: left;
          margin: 0.25rem 1.25rem 0.5rem 0;
          clear: left;
        }
        .chapter-book-image-wrapper[data-align='right'] {
          float: right;
          margin: 0.25rem 0 0.5rem 1.25rem;
          clear: right;
        }
        /* Full-bleed wins over alignment: declared LAST and uses
           !important on float/margin so any prior data-align state
           (float left/right, auto margins) is overridden. The negative
           margin pulls the wrapper out of the prose column to fill the
           editor card via container query. */
        @container editor-card (min-width: 1px) {
          .chapter-book-image-wrapper[data-fullbleed='true'] {
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
          .chapter-book-image-wrapper[data-fullbleed='true'] {
            width: 880px !important;
            max-width: 90vw !important;
            margin-left: auto !important;
            margin-right: auto !important;
            float: none !important;
          }
        }
        .chapter-book-image-wrapper img {
          width: 100%;
          height: auto;
          border-radius: 8px;
          display: block;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
        }
        .chapter-book-image-wrapper.is-selected img {
          outline: 2px solid #2563eb;
          outline-offset: 2px;
        }
        .chapter-book-image-handle {
          position: absolute;
          right: -6px;
          bottom: -6px;
          width: 14px;
          height: 14px;
          background: #2563eb;
          border: 2px solid white;
          border-radius: 50%;
          cursor: nwse-resize;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }
        .chapter-book-image-controls {
          position: absolute;
          top: -36px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 2px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
          font-family: ui-sans-serif, system-ui, sans-serif;
          white-space: nowrap;
          z-index: 10;
        }
        .chapter-book-image-controls button {
          min-width: 28px;
          height: 26px;
          padding: 0 6px;
          font-size: 12px;
          font-weight: 600;
          color: #4b5563;
          border-radius: 4px;
          background: transparent;
        }
        .chapter-book-image-controls button:hover {
          background: #f3f4f6;
        }
        .chapter-book-image-controls button[data-active='true'] {
          background: #dbeafe;
          color: #1d4ed8;
        }
        .chapter-book-image-controls-sep {
          display: inline-block;
          width: 1px;
          height: 16px;
          background: #e5e7eb;
          margin: 0 4px;
        }
        /* Clear floats only at page-break boundaries so a floated image
           on one page doesn't bleed into the next. Earlier this was on
           every <p>, which prevented text wrap entirely — every paragraph
           after a floated image got pushed below it instead of wrapping
           around. */
        .chapter-book-prose .chapter-book-page-break {
          clear: both;
        }
        .chapter-book-prose .chapter-book-page-break {
          position: relative;
          margin: 2.25rem 0;
          height: 1.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chapter-book-prose .chapter-book-page-break::before {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: 50%;
          height: 1px;
          background: repeating-linear-gradient(
            90deg,
            #d1d5db 0,
            #d1d5db 6px,
            transparent 6px,
            transparent 12px
          );
        }
        .chapter-book-prose .chapter-book-page-break-label {
          position: relative;
          background: white;
          color: #6b7280;
          font-size: 0.7rem;
          font-family: ui-sans-serif, system-ui, sans-serif;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0 0.75rem;
        }
        .chapter-book-prose p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: Editor;
}

function Toolbar({ editor }: ToolbarProps) {
  return (
    // Border-b lives on the sticky wrapper so we don't double up.
    <div className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto bg-white [scrollbar-width:thin]">
      <Group>
        <IconBtn
          icon={<Undo2 className="w-4 h-4" />}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo (⌘Z)"
        />
        <IconBtn
          icon={<Redo2 className="w-4 h-4" />}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo (⌘⇧Z)"
        />
      </Group>

      <Sep />

      <Group>
        <IconBtn
          icon={<BoldIcon className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (⌘B)"
        />
        <IconBtn
          icon={<ItalicIcon className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (⌘I)"
        />
        <IconBtn
          icon={<UnderlineIcon className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (⌘U)"
        />
        <IconBtn
          icon={<Strikethrough className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        />
      </Group>

      <Sep />

      <Group>
        <IconBtn
          icon={<Heading1 className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Big heading"
        />
        <IconBtn
          icon={<Heading2 className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Chapter heading"
        />
        <FontFamilyDropdown editor={editor} />
        <FontSizeDropdown editor={editor} />
      </Group>

      <Sep />

      <Group>
        <IconBtn
          icon={<List className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        />
        <IconBtn
          icon={<ListOrdered className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        />
        <IconBtn
          icon={<Quote className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Block quote"
        />
      </Group>

      <Sep />

      <Group>
        <IconBtn
          icon={<AlignLeft className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align left"
        />
        <IconBtn
          icon={<AlignCenter className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align center"
        />
        <IconBtn
          icon={<AlignRight className="w-4 h-4" />}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align right"
        />
      </Group>

      <Sep />

      <Group>
        <ColorDropdown editor={editor} />
        <IconBtn
          icon={<Highlighter className="w-4 h-4" />}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          title="Highlight"
        />
      </Group>

      <Sep />

      <Group>
        <IconBtn
          icon={<FilePlus2 className="w-4 h-4" />}
          onClick={() => editor.chain().focus().insertPageBreak().run()}
          title="New page (⌘↵)"
        />
      </Group>
    </div>
  );
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function Sep() {
  return <span className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" aria-hidden />;
}

interface IconBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
}

function IconBtn({ icon, onClick, active, disabled, title }: IconBtnProps) {
  return (
    <button
      type="button"
      // CRITICAL: prevent the button from stealing focus from the editor
      // on mousedown. Without this, the editor's selection is lost the
      // moment the button is pressed, and chain().focus() only restores
      // focus — not the cursor position — so commands like toggleBlockquote,
      // toggleBulletList, setColor silently apply to nowhere.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`w-9 h-9 flex items-center justify-center rounded-lg transition-colors flex-shrink-0 ${
        active
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
    >
      {icon}
    </button>
  );
}

/**
 * usePopover — dropdowns above the toolbar would be clipped by overflow-x-auto
 * (CSS forces overflow-y: auto when overflow-x: auto), so dropdowns render
 * into a portal at <body> with fixed positioning. Click-outside closes.
 */
function usePopover() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        popoverRef.current?.contains(t) ||
        triggerRef.current?.contains(t)
      ) {
        return;
      }
      setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  return { open, setOpen, triggerRef, popoverRef, pos };
}

// Lora and Comic Neue are bundled locally (see /public/fonts/ + the
// @font-face block in globals.css) so they render identically on every
// device. Comic Neue leads the Comic stack now: previously 'Comic Sans
// MS' came first, which iOS doesn't ship, causing the chain to fall
// through to system cursive (Snell Roundhand) on mobile.
const FONT_FAMILIES: Array<{ key: string; label: string; stack: string }> = [
  { key: 'serif', label: 'Storybook', stack: "'Lora', Georgia, 'Times New Roman', serif" },
  { key: 'sans', label: 'Clean', stack: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  { key: 'comic', label: 'Comic', stack: "'Comic Neue', 'Comic Sans MS', cursive" },
  { key: 'mono', label: 'Typewriter', stack: "ui-monospace, 'Courier New', monospace" },
];

function FontFamilyDropdown({ editor }: { editor: Editor }) {
  const { open, setOpen, triggerRef, popoverRef, pos } = usePopover();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const apply = (stack: string | null) => {
    if (stack === null) {
      editor.chain().focus().unsetFontFamily().run();
    } else {
      editor.chain().focus().setFontFamily(stack).run();
    }
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title="Font"
        aria-label="Font"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0"
      >
        <CaseSensitive className="w-4 h-4" />
      </button>
      {mounted && open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {FONT_FAMILIES.map((f) => (
            <button
              key={f.key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(f.stack)}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              style={{ fontFamily: f.stack }}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(null)}
            className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100 hover:bg-gray-50"
          >
            Default
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

function FontSizeDropdown({ editor }: { editor: Editor }) {
  const { open, setOpen, triggerRef, popoverRef, pos } = usePopover();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const apply = (key: FontSizeKey | null) => {
    if (key === null) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(FONT_SIZES[key]).run();
    }
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title="Font size"
        aria-label="Font size"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0"
      >
        <Type className="w-4 h-4" />
      </button>
      {mounted && open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-32 bg-white border border-gray-200 rounded-lg shadow-lg py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {(['small', 'normal', 'large'] as FontSizeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(key)}
              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              style={{ fontSize: FONT_SIZES[key] }}
            >
              {key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(null)}
            className="block w-full text-left px-3 py-1.5 text-xs text-gray-500 border-t border-gray-100 hover:bg-gray-50"
          >
            Default
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

function ColorDropdown({ editor }: { editor: Editor }) {
  const { open, setOpen, triggerRef, popoverRef, pos } = usePopover();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        title="Text color"
        aria-label="Text color"
        aria-haspopup="true"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 hover:text-gray-900 flex-shrink-0"
      >
        <Palette className="w-4 h-4" />
      </button>
      {mounted && open && pos && createPortal(
        <div
          ref={popoverRef}
          className="fixed z-50 w-44 bg-white border border-gray-200 rounded-lg shadow-lg p-2"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="grid grid-cols-7 gap-1">
            {COLOR_PALETTE.map((c) => (
              <button
                key={c.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  editor.chain().focus().setColor(c.value).run();
                  setOpen(false);
                }}
                title={c.label}
                aria-label={c.label}
                className="w-5 h-5 rounded-full border border-gray-300 hover:ring-2 hover:ring-blue-400"
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.chain().focus().unsetColor().run();
              setOpen(false);
            }}
            className="block w-full mt-2 text-xs text-gray-500 hover:text-gray-700 border-t border-gray-100 pt-1.5"
          >
            Reset to default
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

/** Renders the save status into the parent-mounted slot via a CustomEvent. */
function SaveIndicatorPortal({ status }: { status: SaveStatus }) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(
      new CustomEvent('chapter-book-save-status', { detail: status })
    );
  }, [status]);
  return null;
}

// ── Doc walking helpers ───────────────────────────────────────────────

function approxNodeSize(node: JSONContent): number {
  if (!node || !node.type) return 0;
  if (node.type === 'pageBreak' || node.type === 'horizontalRule' || node.type === 'image') {
    return 1;
  }
  let size = 2;
  for (const child of node.content ?? []) {
    if (child.type === 'text') {
      size += (child.text ?? '').length;
    } else {
      size += approxNodeSize(child);
    }
  }
  return size;
}

function extractText(node: JSONContent): string {
  if (!node) return '';
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(extractText).join(' ');
}
