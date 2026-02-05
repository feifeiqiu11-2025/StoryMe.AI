/**
 * Writing Coach Modal
 *
 * Two coaching sections:
 * 1. Polish Your Writing — Grammarly-style inline diff (strikethrough old + green new woven into text)
 * 2. Strengthen Your Story — 3 guiding questions, More Tips button
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { diffWords } from 'diff';
import { StoryTemplateId } from '@/lib/types/story';
import type { Character } from '@/lib/types/story';

interface WritingCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  script: string;
  templateId: StoryTemplateId | null;
  characters: Character[];
  readingLevel: number;
  onAcceptPolish: (newScript: string) => void;
}

interface CoachingData {
  polish: {
    revisedScript: string;
    changes: { original: string; revised: string; type: string }[];
  };
  strengthen: {
    tips: string[];
    focus: string;
  };
}

/**
 * Renders an inline word-level diff between original and revised text.
 * Removed words: red strikethrough. Added words: green.
 * Unchanged words: default gray.
 */
function InlineDiff({ original, revised }: { original: string; revised: string }) {
  const parts = useMemo(() => diffWords(original, revised), [original, revised]);

  return (
    <div className="text-sm leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.removed) {
          return (
            <span key={i} className="line-through text-red-400 bg-red-50/60">
              {part.value}
            </span>
          );
        }
        if (part.added) {
          return (
            <span key={i} className="text-green-600 bg-green-50/60">
              {part.value}
            </span>
          );
        }
        return (
          <span key={i} className="text-gray-800">
            {part.value}
          </span>
        );
      })}
    </div>
  );
}

export default function WritingCoachModal({
  isOpen,
  onClose,
  script,
  templateId,
  characters,
  readingLevel,
  onAcceptPolish,
}: WritingCoachModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CoachingData | null>(null);
  const [polishAccepted, setPolishAccepted] = useState(false);
  // Client-side tip append: show 3 initially, append 3 more on each "More tips" click
  const [allTips, setAllTips] = useState<string[]>([]);
  const [visibleTipCount, setVisibleTipCount] = useState(3);
  const TIPS_PER_BATCH = 3;

  const fetchCoaching = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPolishAccepted(false);

    try {
      const response = await fetch('/api/writing-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script,
          templateId,
          characters: characters.map(c => ({
            name: c.name,
            description: [
              c.description.age ? `${c.description.age} years old` : '',
              c.description.hairColor ? `${c.description.hairColor} hair` : '',
              c.description.otherFeatures || '',
            ].filter(Boolean).join(', '),
          })),
          readingLevel,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get coaching suggestions');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Coaching failed');
      }

      // Store all tips for client-side append
      const tips = result.strengthen?.tips || [];
      setAllTips(tips);
      setVisibleTipCount(TIPS_PER_BATCH);

      setData({
        polish: result.polish,
        strengthen: result.strengthen,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [script, templateId, characters, readingLevel]);

  // Fetch on mount when modal opens
  useEffect(() => {
    if (isOpen && script.trim()) {
      fetchCoaching();
    }
    // Reset state when modal closes
    if (!isOpen) {
      setData(null);
      setError(null);
      setPolishAccepted(false);
      setAllTips([]);
      setVisibleTipCount(3);
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAcceptPolish = () => {
    if (data?.polish.revisedScript) {
      onAcceptPolish(data.polish.revisedScript);
      setPolishAccepted(true);
    }
  };

  const hasChanges = data ? data.polish.changes.length > 0 : false;

  // Count changes by computing diff parts
  const changeCount = useMemo(() => {
    if (!data) return 0;
    const parts = diffWords(script, data.polish.revisedScript);
    return parts.filter(p => p.added || p.removed).length;
  }, [data, script]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Writing Coach</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Loading State */}
          {loading && (
            <div className="space-y-4">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-24 bg-gray-100 rounded"></div>
                <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                <div className="h-16 bg-gray-100 rounded"></div>
              </div>
              <p className="text-sm text-gray-400 text-center">Analyzing your script...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-700">{error}</p>
              <button
                onClick={fetchCoaching}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Results */}
          {data && !loading && (
            <>
              {/* Polish Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Polish Your Writing
                  </h3>
                  {changeCount > 0 && (
                    <span className="text-xs text-gray-400">
                      {changeCount} edit{changeCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {hasChanges ? (
                  <div className="space-y-3">
                    {/* Grammarly-style inline diff */}
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <InlineDiff original={script} revised={data.polish.revisedScript} />
                    </div>

                    {/* Accept / Retry buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleAcceptPolish}
                        disabled={polishAccepted}
                        className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
                          polishAccepted
                            ? 'bg-green-100 text-green-700 cursor-default'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {polishAccepted ? 'Applied' : 'Accept'}
                      </button>
                      {!polishAccepted && (
                        <button
                          onClick={fetchCoaching}
                          className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-700">Your writing looks clean — no corrections needed.</p>
                  </div>
                )}
              </div>

              {/* Strengthen Section */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-2">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Strengthen Your Story
                  {data.strengthen.focus && (
                    <span className="text-xs text-purple-400 font-normal ml-1">
                      ({data.strengthen.focus})
                    </span>
                  )}
                </h3>

                <div className="bg-purple-50/50 border border-purple-100 rounded-lg p-3 space-y-3">
                  {allTips.slice(0, visibleTipCount).map((tip, idx) => (
                    <div key={idx} className="flex gap-2.5 text-sm">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-semibold mt-0.5">
                        {idx + 1}
                      </span>
                      <p className="text-gray-700 leading-relaxed">{tip}</p>
                    </div>
                  ))}

                  <p className="text-xs text-gray-400 italic pt-1">
                    Use these ideas to improve your script
                  </p>

                  {/* More tips button — append from local cache, re-fetch when exhausted */}
                  {visibleTipCount < allTips.length ? (
                    <div className="pt-1">
                      <button
                        onClick={() => setVisibleTipCount(prev => prev + TIPS_PER_BATCH)}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors"
                      >
                        Show more tips ({allTips.length - visibleTipCount} remaining)
                      </button>
                    </div>
                  ) : (
                    <div className="pt-1">
                      <button
                        onClick={fetchCoaching}
                        disabled={loading}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium transition-colors disabled:text-purple-300"
                      >
                        {loading ? 'Loading...' : 'Refresh tips'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
