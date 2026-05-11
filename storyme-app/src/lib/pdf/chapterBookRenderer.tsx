/**
 * Chapter book PDF — thin client wrapper.
 *
 * The actual PDF rendering lives server-side now: a headless Chromium
 * function at /api/v1/chapter-books/[id]/pdf prints the same HTML the
 * web reader uses. This file used to host a react-pdf renderer
 * (~400 lines) but react-pdf has no CSS float / true page-break
 * support, which made the PDF diverge sharply from the reader. The
 * Chromium-based path matches the reader by construction.
 *
 * What's kept here:
 *   - ChapterBookPdfFormat type (shared with ExportPdfModal)
 *   - downloadChapterBookPDF helper that POSTs to the API and triggers
 *     a browser download
 *
 * Everything else — Tiptap → react-pdf block mapping, font registration,
 * WebP transcoding, the Tier-2 flex-row hack — is gone, deliberately.
 * The server is now the source of truth for layout.
 */

export type ChapterBookPdfFormat = 'a5' | 'a4' | 'large' | 'letter';

interface DownloadOptions {
  bookId: string;
  title: string | null;
  format?: ChapterBookPdfFormat;
  /** Optional share token for unlisted chapter books. Owners don't
   *  need this (their session cookie is on the request). */
  shareToken?: string | null;
}

/**
 * Build the PDF on the server, download the bytes as a file.
 */
export async function downloadChapterBookPDF(options: DownloadOptions): Promise<void> {
  const { bookId, title, format = 'letter', shareToken } = options;
  const url = shareToken
    ? `/api/v1/chapter-books/${bookId}/pdf?token=${encodeURIComponent(shareToken)}`
    : `/api/v1/chapter-books/${bookId}/pdf`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format }),
  });

  if (!res.ok) {
    let message = 'PDF export failed.';
    try {
      const err = await res.json();
      if (err?.error && typeof err.error === 'string') message = err.error;
    } catch {
      // ignore JSON parse error, keep default message
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const safeTitle = (title ?? 'chapter-book').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${safeTitle}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
