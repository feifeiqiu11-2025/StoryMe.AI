/**
 * /chapter-books/new
 * Creates a fresh chapter-book project for the authed user via the API,
 * then redirects to the editor. Renders a loading state in between so
 * kids see motion instead of a blank page if the request is slow.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewChapterBookPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // Strict-mode in dev double-runs effects; guard so we only POST once.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const create = async () => {
      try {
        const res = await fetch('/api/v1/chapter-books', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok || !data?.project?.id) {
          throw new Error(data?.error || 'Could not create your chapter book.');
        }
        router.replace(`/chapter-books/${data.project.id}/edit`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    };

    create();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <>
            <p className="text-red-600 font-semibold mb-3">{error}</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Back to Dashboard
            </button>
          </>
        ) : (
          <>
            <div
              className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"
              role="status"
              aria-label="Creating your chapter book"
            />
            <p className="text-gray-600">Opening a blank book for you…</p>
          </>
        )}
      </div>
    </div>
  );
}
