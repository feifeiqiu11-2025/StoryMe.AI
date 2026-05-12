/**
 * /chapter-books/[id]/read
 *
 * Two modes:
 *   - Default: loads via /api/v1/chapter-books/[id]/public (public + token)
 *   - ?preview=1: loads via /api/v1/chapter-books/[id] (owner-only) so kids
 *     can preview an unpublished draft without making it public first
 *
 * Renders the Tiptap doc with the paginated reader.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { JSONContent } from '@tiptap/react';

// Render the reader client-only. ChapterBookReader transitively imports
// `isomorphic-dompurify`, which pulls in jsdom; jsdom's SSR-side
// `fs.readFileSync` for its default stylesheet resolves to a path that
// webpack/Next.js can't satisfy in the server bundle, so SSR'ing this
// page throws ENOENT before the user's HTML is ever produced. The
// dashboard route used to mask this by short-circuiting with an auth
// redirect; now that the page is anonymous-friendly, we have to keep
// the reader off the server.
const ChapterBookReader = dynamic(
  () =>
    import('@/components/chapter-book/ChapterBookReader').then(
      (m) => m.ChapterBookReader
    ),
  { ssr: false }
);

interface BookForReader {
  id: string;
  title: string | null;
  authorName: string | null;
  editorDoc: JSONContent | null;
}

export default function ChapterBookReadPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const token = searchParams.get('token');
  // Preview mode just decides which API endpoint to hit — owner-only vs.
  // public — so private books load for the owner without auto-publishing.
  // No visible banner; the URL query is enough.
  const isPreview = searchParams.get('preview') === '1';

  const [book, setBook] = useState<BookForReader | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    // Preview mode pulls from the owner endpoint so unpublished drafts work.
    const url = isPreview
      ? `/api/v1/chapter-books/${id}`
      : token
        ? `/api/v1/chapter-books/${id}/public?token=${encodeURIComponent(token)}`
        : `/api/v1/chapter-books/${id}/public`;

    fetch(url)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'This chapter book is unavailable.');
          return;
        }
        // Both endpoints return { project: { ... } } but with slightly
        // different field shapes — owner has shareToken, public has
        // viewCount. We only need title/author/editorDoc here.
        setBook({
          id: data.project.id,
          title: data.project.title ?? null,
          authorName: data.project.authorName ?? null,
          editorDoc: data.project.editorDoc ?? null,
        });
        // Fire-and-forget view tracking. Owner-preview mode and unlisted
        // token reads don't count toward analytics. Public reads explicitly
        // POST so the counter reflects actual opens (the GET endpoint is
        // CDN-cached, so it can't be the source of truth for view counts).
        if (!isPreview) {
          void fetch(`/api/stories/public/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'view' }),
          }).catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load.'));
  }, [id, token, isPreview]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-3">{error}</p>
          <Link
            href="/community-stories"
            className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Browse Community Stories
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
            aria-label="Loading the chapter book"
          />
          <p className="text-gray-600">Opening the book…</p>
        </div>
      </div>
    );
  }

  // Exit destination: owners (preview mode) go back to their book's
  // details page; public readers go to the community feed. Falls back
  // to browser back if the route history makes that obvious.
  const onExit = () => {
    if (isPreview && id) {
      router.push(`/chapter-books/${id}`);
    } else {
      router.push('/community-stories');
    }
  };

  return (
    <ChapterBookReader
      title={book.title}
      authorName={book.authorName}
      doc={book.editorDoc}
      onExit={onExit}
    />
  );
}
