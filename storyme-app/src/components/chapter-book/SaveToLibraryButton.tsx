/**
 * SaveToLibraryButton — chapter-book "Save to library" affordance.
 *
 * Mirrors the picture-book "Save to My Stories" UX: clicking opens a
 * modal that collects title (prefilled), description, author name,
 * author age, language. On submit:
 *   1. Render the editor's first page to PNG (html2canvas) — book cover
 *   2. Upload the cover via /api/v1/editor/upload-image
 *   3. POST /api/v1/chapter-books/[id]/save with metadata + cover URL
 *   4. Redirect to /chapter-books/[id] (details page)
 *
 * Saving sets status='completed' but visibility='private' — matching
 * picture books, the kid toggles public separately on the details page.
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X as XIcon } from 'lucide-react';

interface SaveToLibraryButtonProps {
  bookId: string;
  /** Live values from the editor's top-bar / project — used to prefill the modal. */
  initialTitle: string;
  initialDescription?: string | null;
  initialAuthorName?: string | null;
  initialAuthorAge?: number | null;
  initialLanguage?: string | null;
  /** True once the project is status='completed'; switches the CTA. */
  alreadySaved?: boolean;
}

export function SaveToLibraryButton({
  bookId,
  initialTitle,
  initialDescription,
  initialAuthorName,
  initialAuthorAge,
  initialLanguage,
  alreadySaved,
}: SaveToLibraryButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (alreadySaved) {
    return (
      <button
        type="button"
        onClick={() => router.push(`/chapter-books/${bookId}`)}
        className="px-3 h-9 rounded-lg text-sm font-semibold bg-green-100 text-green-800 hover:bg-green-200"
      >
        View in Library
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-4 h-9 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
      >
        Save to Library
      </button>
      <SaveToLibraryModal
        open={open}
        onClose={() => setOpen(false)}
        bookId={bookId}
        initialTitle={initialTitle}
        initialDescription={initialDescription ?? ''}
        initialAuthorName={initialAuthorName ?? ''}
        initialAuthorAge={initialAuthorAge ?? null}
        initialLanguage={initialLanguage ?? ''}
        onSaved={() => router.push(`/chapter-books/${bookId}`)}
      />
    </>
  );
}

interface SaveToLibraryModalProps {
  open: boolean;
  onClose: () => void;
  bookId: string;
  initialTitle: string;
  initialDescription: string;
  initialAuthorName: string;
  initialAuthorAge: number | null;
  initialLanguage: string;
  onSaved: () => void;
}

function SaveToLibraryModal({
  open,
  onClose,
  bookId,
  initialTitle,
  initialDescription,
  initialAuthorName,
  initialAuthorAge,
  initialLanguage,
  onSaved,
}: SaveToLibraryModalProps) {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [authorAge, setAuthorAge] = useState<string>(
    initialAuthorAge != null ? String(initialAuthorAge) : ''
  );
  const [language, setLanguage] = useState(initialLanguage);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refresh prefills whenever the modal is re-opened so the latest
  // editor title flows in.
  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setAuthorName(initialAuthorName);
      setAuthorAge(initialAuthorAge != null ? String(initialAuthorAge) : '');
      setLanguage(initialLanguage);
      setError(null);
    }
  }, [open, initialTitle, initialDescription, initialAuthorName, initialAuthorAge, initialLanguage]);

  const onSave = async () => {
    if (saving) return;
    if (!title.trim()) {
      setError('Please give your book a title.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Render the cover client-side from the editor's first page.
      const coverUrl = await renderFirstPageCover();

      const res = await fetch(`/api/v1/chapter-books/${bookId}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          authorName: authorName.trim() || undefined,
          authorAge: authorAge ? Number(authorAge) : undefined,
          language: language || undefined,
          coverImageUrl: coverUrl ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 id="save-modal-title" className="text-lg font-bold text-gray-900">
            Save to Library
          </h2>
          <button
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1 rounded disabled:opacity-50"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            Once saved, your book lives in your library. You can choose to share it with the community
            from the next screen.
          </p>

          <div>
            <label htmlFor="save-title" className="block text-xs font-semibold text-gray-700 mb-1">
              Book title
            </label>
            <input
              id="save-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="save-desc" className="block text-xs font-semibold text-gray-700 mb-1">
              Short description (optional)
            </label>
            <textarea
              id="save-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="What's your book about?"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="save-author" className="block text-xs font-semibold text-gray-700 mb-1">
                Your name
              </label>
              <input
                id="save-author"
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                maxLength={80}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="save-age" className="block text-xs font-semibold text-gray-700 mb-1">
                Your age
              </label>
              <input
                id="save-age"
                type="number"
                inputMode="numeric"
                min={3}
                max={18}
                value={authorAge}
                onChange={(e) => setAuthorAge(e.target.value)}
                placeholder="Optional"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="save-lang" className="block text-xs font-semibold text-gray-700 mb-1">
              Secondary language (optional)
            </label>
            <select
              id="save-lang"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">English only</option>
              <option value="zh">Chinese (中文)</option>
              <option value="ko">Korean (한국어)</option>
              <option value="es">Spanish (Español)</option>
              <option value="fr">French (Français)</option>
            </select>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 h-9 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 h-9 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Render the editor's first page (pre-pageBreak) to a PNG, upload it, and
 * return the public URL. Same logic as before — kept here because it's
 * tightly coupled to the save flow.
 */
async function renderFirstPageCover(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const editorRoot = document.querySelector('.chapter-book-prose');
  if (!editorRoot) return null;

  // html2canvas 1.4.1 does NOT support CSS container queries, so the
  // editor's @container rule that gives full-bleed images width:100cqi
  // is invisible to the snapshotter. Without intervention, fullbleed
  // images fall back to max-width:100% and we get 48px of white margin
  // on each side of the saved cover. We work around this by explicitly
  // inlining the edge-to-edge sizing on each fullbleed wrapper/image
  // we find in the clone, below.
  const CLONE_WIDTH = 680;
  const CLONE_PADDING = 48;

  const clone = document.createElement('div');
  clone.style.cssText = `
    position: fixed;
    top: -10000px;
    left: -10000px;
    width: ${CLONE_WIDTH}px;
    background: white;
    padding: ${CLONE_PADDING}px;
    font-family: 'Lora', Georgia, serif;
    font-size: 20px;
    line-height: 1.7;
    color: #1f2937;
  `;
  clone.className = 'chapter-book-prose';

  for (const child of Array.from(editorRoot.children)) {
    if (
      child instanceof HTMLElement &&
      child.classList.contains('chapter-book-page-break')
    ) {
      break;
    }
    clone.appendChild(child.cloneNode(true));
  }

  if (!clone.children.length) return null;

  // Force every full-bleed image (wrapper or bare img) to stretch edge-
  // to-edge with explicit pixel math. We can't lean on container
  // queries because html2canvas doesn't evaluate them.
  const fullBleedNodes = clone.querySelectorAll<HTMLElement>('[data-fullbleed="true"]');
  fullBleedNodes.forEach((el) => {
    el.style.width = `${CLONE_WIDTH}px`;
    el.style.maxWidth = 'none';
    el.style.marginLeft = `-${CLONE_PADDING}px`;
    el.style.marginRight = `-${CLONE_PADDING}px`;
    el.style.float = 'none';
    el.style.display = 'block';
    // First-child fullbleed = book cover; pull it flush to the top so
    // there's no white strip above the artwork in the saved PNG.
    if (el === clone.firstElementChild) {
      el.style.marginTop = `-${CLONE_PADDING}px`;
    }
    // If the wrapper contains a child img (editor's NodeView path),
    // make sure the inner img fills the wrapper.
    const innerImg = el.querySelector('img');
    if (innerImg) {
      innerImg.style.width = '100%';
      innerImg.style.maxWidth = 'none';
      innerImg.style.height = 'auto';
      innerImg.style.display = 'block';
    }
  });

  document.body.appendChild(clone);
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(clone, {
      backgroundColor: '#ffffff',
      scale: 1.5,
      logging: false,
      useCORS: true,
    });
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/png', 0.92)
    );
    if (!blob) return null;

    const form = new FormData();
    form.append('file', new File([blob], 'cover.png', { type: 'image/png' }));
    const res = await fetch('/api/v1/editor/upload-image', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) {
      console.error('Cover upload failed:', data);
      return null;
    }
    return data.image.url as string;
  } finally {
    document.body.removeChild(clone);
  }
}
