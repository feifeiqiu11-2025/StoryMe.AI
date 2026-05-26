/**
 * LeftRail — DAW-style side rail with an always-visible icon strip and an
 * optional expanded panel that slots in to the right of the strip.
 *
 * Behavior:
 *   - Click an icon: open that tab's panel (sets activeTabId).
 *   - Click the same icon again, or the panel's × button: collapse.
 *   - Clicking outside does NOT collapse (DAW convention — the rail stays
 *     put while users drag clips around).
 *   - Esc closes the panel; host wires up via onTabChange(null).
 *
 * Layout: icon strip is a fixed 48px column; the panel is 360px wide when
 * shown. The whole rail sits as a flex child inside the host's content area;
 * the timeline column to the right gets whatever space is left.
 */

'use client';

import { ReactNode, useEffect } from 'react';

export interface RailTab {
  id: string;
  /** Lucide icon element (or any 16-20px icon ReactNode). */
  icon: ReactNode;
  /** Used for the icon tooltip and the panel header. */
  label: string;
  content: ReactNode;
}

interface LeftRailProps {
  tabs: RailTab[];
  activeTabId: string | null;
  onTabChange: (id: string | null) => void;
}

export default function LeftRail({ tabs, activeTabId, onTabChange }: LeftRailProps) {
  const active = tabs.find((t) => t.id === activeTabId) ?? null;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Skip when the user is typing in an input — Esc should clear focus,
      // not collapse the rail underneath them.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      onTabChange(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onTabChange]);

  return (
    <div className="flex flex-shrink-0 h-full border-r border-gray-200 bg-gray-50">
      {/* Icon strip — always visible. Active state = purple icon + thin
          left accent bar; no full background fill, so the strip stays narrow. */}
      <div className="w-9 flex flex-col items-center py-2 gap-0.5 flex-shrink-0">
        {tabs.map((t) => {
          const isActive = t.id === activeTabId;
          return (
            <button
              key={t.id}
              onClick={() => onTabChange(isActive ? null : t.id)}
              className={`relative w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                isActive
                  ? 'text-purple-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
              }`}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isActive}
            >
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-purple-600 rounded-r" aria-hidden />
              )}
              {t.icon}
            </button>
          );
        })}
      </div>
      {/* Expanded panel — slides in to the right of the icon strip. */}
      {active && (
        <div className="w-[360px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
            <h3 className="text-sm font-semibold text-gray-900">{active.label}</h3>
            <button
              onClick={() => onTabChange(null)}
              aria-label={`Close ${active.label}`}
              className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">{active.content}</div>
        </div>
      )}
    </div>
  );
}
