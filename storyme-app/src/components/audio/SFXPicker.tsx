/**
 * SFXPicker — modal for browsing the curated sound-effects library and
 * picking a sound to add as a layer on the current page.
 *
 * Tabs:
 *   - Library     — sounds already in our sfx_library table
 *   - Freesound   — live search of Freesound CC0 catalog via proxy. Picking
 *                   triggers an import (copy to our bucket + insert row)
 *                   before handing the SfxLibraryItem to the caller.
 *
 * Pure presentation + data fetch — does NOT own placement state. Calling
 * code (the Recorder) decides what to do with the picked sound.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface SfxLibraryItem {
  id: string;
  name: string;
  tags: string[];
  audio_url: string;
  duration_sec: number;
  source: 'curated' | 'freesound' | 'elevenlabs_cache';
  kid_safe: boolean;
  attribution: string | null;
  license: 'CC0' | 'CC-BY' | 'proprietary';
  /** Set on Freesound search results before import. */
  external_id?: string;
}

type Tab = 'library' | 'freesound';

interface SFXPickerProps {
  open: boolean;
  onClose: () => void;
  onPick: (sound: SfxLibraryItem) => void;
}

export default function SFXPicker({ open, onClose, onPick }: SFXPickerProps) {
  const [tab, setTab] = useState<Tab>('library');
  const [sounds, setSounds] = useState<SfxLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [importingExternalId, setImportingExternalId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const fetchSounds = useCallback(
    async (currentTab: Tab, q: string) => {
      setLoading(true);
      setError(null);
      // Note: we intentionally DON'T clear `sounds` here — keeping the
      // previous results visible while loading new ones is much less
      // jarring than flashing an empty state on every keystroke.
      try {
        if (currentTab === 'freesound') {
          if (q.trim().length < 2) {
            // Freesound requires a real query — empty state with a prompt.
            setSounds([]);
            setLoading(false);
            return;
          }
          const url = new URL('/api/v1/sfx-library/freesound', window.location.origin);
          url.searchParams.set('q', q.trim());
          url.searchParams.set('pageSize', '24');
          const res = await fetch(url.toString());
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          setSounds(data.sounds ?? []);
        } else {
          const url = new URL('/api/v1/sfx-library', window.location.origin);
          if (q.trim()) url.searchParams.set('q', q.trim());
          url.searchParams.set('limit', '60');
          const res = await fetch(url.toString());
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          setSounds(data.sounds ?? []);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load sounds');
        setSounds([]);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { fetchSounds(tab, query); }, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [open, tab, query, fetchSounds]);

  // On close: stop any preview audio AND clear the search query so the
  // next open isn't haunted by the previous session's text.
  useEffect(() => {
    if (!open) {
      if (audioRef.current) audioRef.current.pause();
      setPreviewingId(null);
      setQuery('');
    }
  }, [open]);

  const playPreview = (sound: SfxLibraryItem) => {
    if (!audioRef.current) return;
    if (previewingId === sound.id) {
      audioRef.current.pause();
      setPreviewingId(null);
      return;
    }
    audioRef.current.src = sound.audio_url;
    audioRef.current.play()
      .then(() => setPreviewingId(sound.id))
      .catch((err) => console.error('Preview failed:', err));
  };

  const handlePick = async (sound: SfxLibraryItem) => {
    // Freesound results need to be imported (copied to our bucket + inserted)
    // before they can be referenced from a story's audio_layers, because the
    // direct Freesound CDN URLs aren't guaranteed stable for our app's
    // lifetime. The library tab returns rows that already live in our DB.
    if (sound.source === 'freesound' && sound.external_id) {
      setImportingExternalId(sound.external_id);
      try {
        const res = await fetch('/api/v1/sfx-library/freesound/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freesoundId: Number(sound.external_id) }),
        });
        const data = await res.json();
        if (!res.ok) {
          alert(`Import failed: ${data.error || res.status}`);
          return;
        }
        onPick(data.sound);
        onClose();
      } catch (err: any) {
        alert(`Import failed: ${err.message || 'Network error'}`);
      } finally {
        setImportingExternalId(null);
      }
    } else {
      onPick(sound);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sound effects library"
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
    >
      <audio ref={audioRef} onEnded={() => setPreviewingId(null)} />
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Add sound effect</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Pick a sound from the library or search Freesound. CC0 only — safe for Spotify publishing.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close picker"
            className="p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-gray-100">
          <div className="flex gap-1">
            <button
              onClick={() => { setTab('library'); setQuery(''); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'library'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Library
            </button>
            <button
              onClick={() => { setTab('freesound'); setQuery(''); }}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === 'freesound'
                  ? 'border-purple-600 text-purple-700'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Freesound
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'freesound'
              ? 'Search Freesound (e.g. door creak, sparkle)…'
              : 'Filter library by name…'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            aria-label="Search sounds"
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 relative">
          {error && (
            <div role="alert" className="p-3 bg-red-50 text-red-700 text-sm rounded-md mb-3">
              {error}
            </div>
          )}
          {!error && sounds.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-700 font-medium mb-1">
                {tab === 'freesound' && query.trim().length < 2
                  ? 'Type at least 2 letters to search Freesound'
                  : 'No sounds found'}
              </p>
              <p className="text-xs text-gray-500">
                {tab === 'library'
                  ? (query ? 'Try a different search term, or switch to the Freesound tab.' : 'An admin needs to seed the library, or use the Freesound tab to import sounds.')
                  : 'Freesound returns CC0 sounds only — try a different query if you got no hits.'}
              </p>
            </div>
          )}
          {!error && sounds.length === 0 && loading && (
            <div className="text-center py-12 text-gray-500 text-sm">Loading…</div>
          )}
          {/* Loading shimmer — dims existing results instead of replacing them */}
          {loading && sounds.length > 0 && (
            <div className="absolute top-2 right-6 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">
              Searching…
            </div>
          )}
          {sounds.length > 0 && (
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sounds.map((s) => {
                const isImporting = importingExternalId === s.external_id;
                return (
                  <li
                    key={s.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-purple-400 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-sm font-semibold text-gray-900 truncate" title={s.name}>{s.name}</span>
                      <span className="text-xs text-gray-500 flex-shrink-0">{s.duration_sec.toFixed(1)}s</span>
                    </div>
                    {s.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {s.tags.slice(0, 4).map((t) => (
                          <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded">{t}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => playPreview(s)}
                        className="flex-1 px-2 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-800 hover:bg-gray-200"
                      >
                        {previewingId === s.id ? '⏸ Stop' : '▶ Preview'}
                      </button>
                      <button
                        onClick={() => handlePick(s)}
                        disabled={isImporting}
                        className="flex-1 px-2 py-1.5 text-xs font-semibold rounded-md bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isImporting ? 'Importing…' : (s.source === 'freesound' ? '+ Import & add' : '+ Add')}
                      </button>
                    </div>
                    {s.attribution && (
                      <p className="mt-1.5 text-[10px] text-gray-400 truncate" title={s.attribution}>{s.attribution}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
