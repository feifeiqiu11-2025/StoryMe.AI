/**
 * Share-link management modal for "share by link" (unlisted) story sharing.
 *
 * Three states the modal renders for:
 *   - inactive (visibility = private/public, no token):
 *       primary action enables share-link
 *   - active (visibility = unlisted with token):
 *       shows URL, copy, regenerate (with confirm), disable
 *   - public:
 *       reminds the user the story is already openly visible — share-link
 *       isn't the right tool here, ask them to make it private first.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

interface ShareLinkPopoverProps {
  storyId: string;
  storyTitle: string;
  visibility: 'private' | 'unlisted' | 'public';
  shareToken: string | null;
  onClose: () => void;
  onUpdated: (next: { visibility: 'private' | 'unlisted' | 'public'; shareToken: string | null }) => void;
}

function buildShareUrl(storyId: string, token: string): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/stories/${storyId}?mode=reading&token=${token}`;
}

export function ShareLinkPopover({
  storyId,
  storyTitle,
  visibility,
  shareToken,
  onClose,
  onUpdated,
}: ShareLinkPopoverProps) {
  const [busy, setBusy] = useState<'enable' | 'regenerate' | 'revoke' | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const isActive = visibility === 'unlisted' && !!shareToken;
  const isPublic = visibility === 'public';
  const shareUrl = isActive && shareToken ? buildShareUrl(storyId, shareToken) : '';

  // Close on ESC; focus the close button when modal mounts so keyboard users
  // land in the dialog instead of the underlying card grid.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    closeButtonRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleEnable = async () => {
    setBusy('enable');
    setError(null);
    try {
      const res = await fetch(`/api/projects/${storyId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to enable share link');
      onUpdated({ visibility: data.visibility, shareToken: data.shareToken });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable share link');
    } finally {
      setBusy(null);
    }
  };

  const handleRegenerate = async () => {
    setBusy('regenerate');
    setError(null);
    setConfirmRegenerate(false);
    try {
      const res = await fetch(`/api/projects/${storyId}/share-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to regenerate link');
      onUpdated({ visibility: data.visibility, shareToken: data.shareToken });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate link');
    } finally {
      setBusy(null);
    }
  };

  const handleRevoke = async () => {
    setBusy('revoke');
    setError(null);
    try {
      const res = await fetch(`/api/projects/${storyId}/share-link`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disable share link');
      onUpdated({ visibility: data.visibility, shareToken: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable share link');
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy to clipboard. Please copy the link manually.');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-link-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 id="share-link-title" className="text-xl font-bold text-gray-900">
              Share by link
            </h3>
            <p className="text-sm text-gray-500 mt-1 truncate" title={storyTitle}>
              {storyTitle}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {isPublic ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              This story is currently <span className="font-semibold">public</span>, so anyone with the
              story link can already read it on the community page.
            </p>
            <p className="text-xs text-gray-500">
              To share with parents privately instead, make the story private from the card, then
              come back here to enable a share-link.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-200 font-semibold transition-all"
            >
              Got it
            </button>
          </div>
        ) : isActive ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Anyone with this link can read the story. It will not appear on the community page.
            </p>

            <div>
              <label htmlFor="share-link-url" className="block text-xs font-medium text-gray-700 mb-1">
                Share link
              </label>
              <div className="flex gap-2">
                <input
                  id="share-link-url"
                  type="text"
                  value={shareUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                />
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-lg font-medium text-sm min-w-[80px] transition-all ${
                    copied
                      ? 'bg-green-500 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  aria-live="polite"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
              {confirmRegenerate ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-900 mb-3">
                    Regenerating creates a new link and immediately breaks the old one. Anyone you
                    sent the old link to will need the new one.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRegenerate}
                      disabled={busy !== null}
                      className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 font-medium text-sm transition-all disabled:opacity-50"
                    >
                      {busy === 'regenerate' ? 'Generating…' : 'Yes, regenerate'}
                    </button>
                    <button
                      onClick={() => setConfirmRegenerate(false)}
                      disabled={busy !== null}
                      className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium text-sm transition-all disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRegenerate(true)}
                  disabled={busy !== null}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium text-left disabled:opacity-50"
                >
                  Generate new link (invalidates the current one)
                </button>
              )}

              <button
                onClick={handleRevoke}
                disabled={busy !== null}
                className="text-sm text-red-600 hover:text-red-800 font-medium text-left disabled:opacity-50"
              >
                {busy === 'revoke' ? 'Disabling…' : 'Disable share link'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-700">
              Create a private link to share this story with parents or family. Only people with the
              link can read it — it will not appear on the community page.
            </p>
            <ul className="text-xs text-gray-500 space-y-1 list-disc pl-5">
              <li>Anyone with the link can view, no sign-in required</li>
              <li>You can disable or regenerate the link any time</li>
              <li>View counts are not tracked while sharing this way</li>
            </ul>

            {error && (
              <div role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              onClick={handleEnable}
              disabled={busy !== null}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 font-semibold transition-all disabled:opacity-50"
            >
              {busy === 'enable' ? 'Creating link…' : 'Create share link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
