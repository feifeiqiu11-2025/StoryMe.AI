'use client';

/**
 * BreakdownModal
 *
 * User-directed "break into parts" flow for characters created from kids'
 * drawings with multiple elements. User types what to extract (e.g., "Fish,
 * Bunny, Magic Items"), we call Gemini vision for bounding boxes, crop each
 * region server-side, and show the crops for review. User can rename,
 * change role, or delete any crop before confirming. Confirming inserts new
 * character rows (source character left untouched).
 *
 * See plan at /Users/feifeiq/.claude/plans/parallel-spinning-milner.md
 */

import { useEffect, useState } from 'react';
import type { Character } from '@/lib/types/story';

interface PlanItem {
  tempKey: string;
  name: string;
  previewUrl: string;
  role: 'character' | 'scene_element';
}

interface BreakdownModalProps {
  isOpen: boolean;
  sourceCharacter: Character | null;
  onClose: () => void;
  onSuccess: (createdCount: number) => void;
}

type Phase = 'idle' | 'planning' | 'review' | 'finalizing' | 'done' | 'error';

const MAX_ELEMENTS = 8;

export default function BreakdownModal({
  isOpen,
  sourceCharacter,
  onClose,
  onSuccess,
}: BreakdownModalProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [instruction, setInstruction] = useState('');
  const [items, setItems] = useState<PlanItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [planMessage, setPlanMessage] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);
  const [failedItems, setFailedItems] = useState<Array<{ name: string; error: string }>>([]);

  // Reset all state when modal closes (required per plan hardening item #7).
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      setInstruction('');
      setItems([]);
      setError(null);
      setPlanMessage(null);
      setCreatedCount(0);
      setFailedItems([]);
    }
  }, [isOpen]);

  if (!isOpen || !sourceCharacter) return null;

  const handlePlan = async () => {
    const trimmed = instruction.trim();
    if (!trimmed) {
      setError('Describe what you want to extract, e.g., "Fish, Bunny, Magic Items"');
      return;
    }
    setError(null);
    setPlanMessage(null);
    setPhase('planning');

    try {
      const response = await fetch(`/api/characters/${sourceCharacter.id}/breakdown/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setError('Image analysis is rate-limited right now. Please try again in a minute.');
        } else {
          setError(data.error || 'Failed to analyze the drawing.');
        }
        setPhase('error');
        return;
      }

      const planItems: PlanItem[] = (data.items || []).map((item: { tempKey: string; name: string; previewUrl: string }) => ({
        tempKey: item.tempKey,
        name: item.name,
        previewUrl: item.previewUrl,
        role: 'character' as const,
      }));

      if (planItems.length === 0) {
        setPlanMessage(data.message || "Couldn't find any of those elements. Try more specific names.");
        setPhase('idle');
        return;
      }

      if (data.rejected && Array.isArray(data.rejected) && data.rejected.length > 0) {
        setPlanMessage(`Skipped: ${data.rejected.join(', ')}`);
      }

      setItems(planItems);
      setPhase('review');
    } catch (err) {
      console.error('[BreakdownModal] Plan error:', err);
      setError(err instanceof Error ? err.message : 'Network error — please try again.');
      setPhase('error');
    }
  };

  const handleFinalize = async () => {
    const kept = items.filter((item) => item.name.trim().length > 0);
    if (kept.length === 0) {
      setError('Please keep at least one item.');
      return;
    }
    setError(null);
    setPhase('finalizing');

    try {
      const response = await fetch(`/api/characters/${sourceCharacter.id}/breakdown/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: kept.map(({ name, role, previewUrl }) => ({ name: name.trim(), role, previewUrl })),
        }),
      });

      const data = await response.json();

      if (!response.ok && (!data.created || data.created.length === 0)) {
        setError(data.error || 'Failed to create new characters.');
        setPhase('error');
        return;
      }

      const count = Array.isArray(data.created) ? data.created.length : 0;
      setCreatedCount(count);
      setFailedItems(Array.isArray(data.failed) ? data.failed : []);
      setPhase('done');

      // Notify parent to refresh the character list
      if (count > 0) {
        onSuccess(count);
      }
    } catch (err) {
      console.error('[BreakdownModal] Finalize error:', err);
      setError(err instanceof Error ? err.message : 'Network error — please try again.');
      setPhase('error');
    }
  };

  const updateItem = (tempKey: string, patch: Partial<PlanItem>) => {
    setItems((prev) => prev.map((it) => (it.tempKey === tempKey ? { ...it, ...patch } : it)));
  };

  const removeItem = (tempKey: string) => {
    setItems((prev) => prev.filter((it) => it.tempKey !== tempKey));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Break &ldquo;{sourceCharacter.name}&rdquo; into parts
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* IDLE / error-from-idle: instruction input */}
          {(phase === 'idle' || phase === 'error' && items.length === 0) && (
            <>
              <div className="mb-4 flex items-start gap-4">
                {sourceCharacter.animatedPreviewUrl && (
                  <img
                    src={sourceCharacter.animatedPreviewUrl}
                    alt={sourceCharacter.name}
                    className="w-24 h-24 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                  />
                )}
                <div className="text-sm text-gray-600">
                  <p className="mb-1">Describe what you&apos;d like to extract from this drawing.</p>
                  <p className="text-xs text-gray-500">
                    Each named element becomes a new character (or scene element). The original
                    character stays unchanged.
                  </p>
                </div>
              </div>

              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={`e.g., "Fish, Bunny, Magic Items (crystal ball, book, dragon)"`}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">Up to {MAX_ELEMENTS} elements per breakdown.</p>

              {planMessage && (
                <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {planMessage}
                </div>
              )}
              {error && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}

          {/* PLANNING spinner */}
          {phase === 'planning' && (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-purple-600 font-medium text-sm">Finding parts…</p>
              <p className="text-xs text-gray-500 mt-1">This takes a few seconds.</p>
            </div>
          )}

          {/* REVIEW: crop list */}
          {phase === 'review' && (
            <>
              <p className="text-sm text-gray-700 mb-3">
                Review each part — rename or delete any you don&apos;t want.
              </p>
              {planMessage && (
                <div className="mb-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                  {planMessage}
                </div>
              )}
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.tempKey}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg"
                  >
                    <img
                      src={item.previewUrl}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded border border-gray-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateItem(item.tempKey, { name: e.target.value })}
                        maxLength={100}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <div className="flex gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => updateItem(item.tempKey, { role: 'character' })}
                          className={`px-2 py-1 rounded border ${item.role === 'character' ? 'bg-purple-100 border-purple-300 text-purple-700 font-medium' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          Character
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.tempKey, { role: 'scene_element' })}
                          className={`px-2 py-1 rounded border ${item.role === 'scene_element' ? 'bg-amber-100 border-amber-300 text-amber-700 font-medium' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                        >
                          Scene element
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.tempKey)}
                      className="text-red-500 hover:text-red-700 p-1"
                      aria-label={`Delete ${item.name}`}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {error && (
                <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}
            </>
          )}

          {/* FINALIZING spinner */}
          {phase === 'finalizing' && (
            <div className="py-12 text-center">
              <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-purple-600 font-medium text-sm">Creating new characters…</p>
            </div>
          )}

          {/* DONE */}
          {phase === 'done' && (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-gray-900 font-medium">
                Created {createdCount} new {createdCount === 1 ? 'item' : 'items'}
              </p>
              <p className="text-sm text-gray-500">
                &ldquo;{sourceCharacter.name}&rdquo; is still in your library — nothing was replaced.
              </p>
              {failedItems.length > 0 && (
                <div className="text-left text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                  <p className="font-medium mb-1">Some items failed:</p>
                  <ul className="list-disc pl-4">
                    {failedItems.map((f, i) => (
                      <li key={i}>{f.name}: {f.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* ERROR with existing items: stay in review */}
          {phase === 'error' && items.length > 0 && (
            <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          {phase === 'idle' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePlan}
                disabled={!instruction.trim()}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Find parts
              </button>
            </>
          )}

          {phase === 'error' && items.length === 0 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setPhase('idle'); setError(null); }}
                className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Try again
              </button>
            </>
          )}

          {phase === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setPhase('idle')}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={items.length === 0 || items.some((i) => !i.name.trim())}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create {items.length} {items.length === 1 ? 'item' : 'items'}
              </button>
            </>
          )}

          {phase === 'error' && items.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => { setPhase('review'); setError(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Try again
              </button>
            </>
          )}

          {phase === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
