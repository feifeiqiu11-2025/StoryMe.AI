/**
 * SFXBrowserPanel — panel-shaped sound browser. Renders inside a LeftRail
 * tab (no modal chrome of its own; the rail provides the header + close).
 *
 * Tabs:
 *   - Library     — sounds already in our sfx_library table
 *   - Freesound   — live CC0 search via /api/v1/sfx-library/freesound; picking
 *                   triggers an import (copy to our bucket + insert row)
 *                   before handing the SfxLibraryItem to the caller.
 *
 * Picking a sound does NOT auto-close the panel — that's the whole point of
 * a side rail vs a modal: browse, audition multiple sounds, layer several
 * in one session. The host (Recorder) controls open/close via the LeftRail.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus } from 'lucide-react';

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

interface SFXBrowserPanelProps {
  onPick: (sound: SfxLibraryItem) => void;
}

export default function SFXBrowserPanel({ onPick }: SFXBrowserPanelProps) {
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
      // Don't clear `sounds` on a new fetch — stale-while-revalidate keeps
      // the previous results visible while loading; flashing an empty grid
      // on every keystroke felt terrible.
      try {
        if (currentTab === 'freesound') {
          if (q.trim().length < 2) {
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
    const t = setTimeout(() => { fetchSounds(tab, query); }, query ? 350 : 0);
    return () => clearTimeout(t);
  }, [tab, query, fetchSounds]);

  // Stop any preview audio on unmount so it doesn't keep playing if the
  // panel collapses while a sound is auditioning.
  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

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
    // before they can be referenced from a story's audio_layers. The library
    // tab returns rows that already live in our DB.
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
      } catch (err: any) {
        alert(`Import failed: ${err.message || 'Network error'}`);
      } finally {
        setImportingExternalId(null);
      }
    } else {
      onPick(sound);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} onEnded={() => setPreviewingId(null)} />
      {/* Tabs */}
      <div className="px-3 pt-2 border-b border-gray-100 flex-shrink-0">
        <div className="flex gap-1">
          <button
            onClick={() => { setTab('library'); setQuery(''); }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === 'library'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => { setTab('freesound'); setQuery(''); }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
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
      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tab === 'freesound'
            ? 'Search Freesound…'
            : 'Filter library…'}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          aria-label="Search sounds"
        />
      </div>

      {/* Body — scrollable list. scrollbar-thin-always keeps the track
          visible on macOS where the OS otherwise auto-hides it, so users
          can see at a glance that the list extends below the fold. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin-always px-3 py-2 relative">
        {error && (
          <div role="alert" className="p-2 bg-red-50 text-red-700 text-xs rounded-md mb-2">
            {error}
          </div>
        )}
        {!error && sounds.length === 0 && !loading && (
          <div className="text-center py-10 px-2">
            <p className="text-gray-700 text-sm font-medium mb-1">
              {tab === 'freesound' && query.trim().length < 2
                ? 'Type at least 2 letters to search'
                : 'No sounds found'}
            </p>
            <p className="text-xs text-gray-500">
              {tab === 'library'
                ? (query ? 'Try a different term, or switch to the Freesound tab.' : 'Switch to Freesound to import sounds.')
                : 'Freesound returns CC0 sounds only.'}
            </p>
          </div>
        )}
        {!error && sounds.length === 0 && loading && (
          <div className="text-center py-10 text-gray-500 text-xs">Loading…</div>
        )}
        {loading && sounds.length > 0 && (
          <div className="absolute top-2 right-3 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">
            Searching…
          </div>
        )}
        {sounds.length > 0 && (
          <ul className="flex flex-col">
            {sounds.map((s) => {
              const isImporting = importingExternalId === s.external_id;
              const isPreviewing = previewingId === s.id;
              const addLabel = s.source === 'freesound'
                ? `Import and add ${s.name}`
                : `Add ${s.name}`;
              return (
                <li
                  key={s.id}
                  className="flex items-center gap-1 px-1.5 py-1.5 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="flex-1 min-w-0 text-xs font-medium text-gray-900 truncate"
                    title={s.name}
                  >
                    {s.name}
                  </span>
                  <span className="text-[10px] text-gray-500 flex-shrink-0 tabular-nums">
                    {s.duration_sec.toFixed(1)}s
                  </span>
                  <button
                    onClick={() => playPreview(s)}
                    aria-label={isPreviewing ? `Stop ${s.name}` : `Preview ${s.name}`}
                    className="p-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors flex-shrink-0"
                  >
                    {isPreviewing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => handlePick(s)}
                    disabled={isImporting}
                    aria-label={isImporting ? 'Importing' : addLabel}
                    className="p-1 rounded text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {isImporting ? (
                      <span className="w-3.5 h-3.5 inline-flex items-center justify-center text-[10px] leading-none">…</span>
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
