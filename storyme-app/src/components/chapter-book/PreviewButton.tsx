/**
 * PreviewButton — opens the reader in a new tab with ?preview=1 so kids
 * can see how the book will look published, without actually publishing.
 *
 * Why a new tab and not an in-page modal: it's the same component readers
 * see, so what the kid sees here matches exactly. New tab also lets them
 * keep editing while previewing.
 */

'use client';

interface PreviewButtonProps {
  bookId: string;
}

export function PreviewButton({ bookId }: PreviewButtonProps) {
  return (
    <a
      href={`/chapter-books/${bookId}/read?preview=1`}
      target="_blank"
      rel="noopener noreferrer"
      className="px-3 h-9 inline-flex items-center rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
    >
      Preview
    </a>
  );
}
