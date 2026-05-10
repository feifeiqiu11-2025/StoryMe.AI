/**
 * /chapter-books/[id]/edit
 *
 * Single-row top bar: breadcrumb · status badge · title input · save state ·
 * Preview / Download / Publish. Editor sits below; MediaPanel pinned right.
 *
 * Loads the editor doc once on mount; the editor handles its own
 * auto-save thereafter.
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { JSONContent, Editor } from '@tiptap/react';
import { ArrowLeft } from 'lucide-react';
import { ChapterBookEditor } from '@/components/chapter-book/ChapterBookEditor';
import { MediaPanel } from '@/components/chapter-book/MediaPanel';
import { SaveToLibraryButton } from '@/components/chapter-book/SaveToLibraryButton';
import { PreviewButton } from '@/components/chapter-book/PreviewButton';

interface ChapterBookDetail {
  id: string;
  title: string | null;
  description: string | null;
  authorName: string | null;
  authorAge: number | null;
  secondaryLanguage: string | null;
  status: string;
  visibility: string | null;
  editorDoc: JSONContent | null;
  shareToken: string | null;
  coverImageUrl: string | null;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function ChapterBookEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [book, setBook] = useState<ChapterBookDetail | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const editorRef = useRef<Editor | null>(null);

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
        setBook(data.project);
        setTitle(data.project.title ?? 'My Chapter Book');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load.');
      }
    };
    load();
  }, [id]);

  // Listen for save-status events the editor dispatches via window.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<SaveStatus>).detail;
      setSaveStatus(detail);
    };
    window.addEventListener('chapter-book-save-status', handler);
    return () => window.removeEventListener('chapter-book-save-status', handler);
  }, []);

  const handleEditorReady = useCallback((editor: Editor) => {
    editorRef.current = editor;
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-3">{error}</p>
          <button
            onClick={() => router.push('/projects')}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Back to My Stories
          </button>
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
          <p className="text-gray-600">Loading your book…</p>
        </div>
      </div>
    );
  }

  return (
    // On lg+ the page is a fixed-viewport flex column: top bar stays put,
    // editor + panel scroll internally. On mobile it falls back to natural
    // page scroll so the URL bar / browser chrome behaves normally.
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">My Stories</span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 text-[11px] font-bold uppercase tracking-wider flex-shrink-0">
            Chapter Book
          </span>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Book title"
            aria-label="Book title"
            className="flex-1 min-w-[160px] text-base sm:text-lg font-semibold text-gray-900 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-gray-400 px-1"
          />

          <SaveIndicator status={saveStatus} />

          <div className="flex items-center gap-2 flex-shrink-0">
            <PreviewButton bookId={book.id} />
            <SaveToLibraryButton
              bookId={book.id}
              initialTitle={title || 'My Chapter Book'}
              initialDescription={book.description}
              initialAuthorName={book.authorName}
              initialAuthorAge={book.authorAge}
              initialLanguage={book.secondaryLanguage}
              alreadySaved={book.status === 'completed'}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 w-full lg:flex-1 lg:min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start lg:h-full">
          <div className="lg:h-full lg:overflow-y-auto lg:pr-1">
            <ChapterBookEditor
              bookId={book.id}
              initialDoc={book.editorDoc}
              title={title}
              onEditorReady={handleEditorReady}
            />
          </div>

          <aside id="media-panel" className="lg:h-full lg:overflow-y-auto">
            <MediaPanel
              onPick={(url, options) => {
                const editor = editorRef.current;
                if (!editor) {
                  // Should never trigger now that we capture on ready, but
                  // a defensive guard keeps the UI from silently no-oping.
                  console.warn('Editor not ready yet');
                  return;
                }
                editor
                  .chain()
                  .focus()
                  .setImage({ src: url, alt: options?.alt ?? 'Inserted image' })
                  .run();
              }}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const label =
    status === 'saving' ? 'Saving…' :
    status === 'saved' ? 'Saved' :
    'Could not save';
  const tone =
    status === 'error' ? 'text-red-600' :
    status === 'saved' ? 'text-green-600' :
    'text-gray-500';
  return (
    <span
      className={`text-xs ${tone} flex-shrink-0`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {label}
    </span>
  );
}
