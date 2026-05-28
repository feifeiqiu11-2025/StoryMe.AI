/**
 * Browser panel for the LeftRail. Two top-level tabs: Sounds | Music.
 * Inside each tab, library and Freesound results are merged into a single
 * scrollable list:
 *   - Library rows first (curated, CC0)
 *   - "More from Freesound" subhead, then Freesound rows (only when the
 *     user has typed a query — we don't burn Freesound API quota on idle
 *     tab opens)
 *   - Infinite scroll appends more results as the sentinel scrolls into view
 *
 * Picking a Freesound row triggers a one-time import: the file is copied
 * to our bucket and a sfx_library row is inserted under the current
 * top-tab's kind. Library rows are added immediately.
 *
 * The host (Recorder) receives onPick(sound, kind) so it can route the
 * placement to either the SFX or music track without inspecting the row.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Plus, Loader2 } from 'lucide-react';

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
  /** Library category, attached by the new GET endpoint. */
  kind?: 'sfx' | 'music';
}

type TopTab = 'sfx' | 'music';

interface SFXBrowserPanelProps {
  onPick: (sound: SfxLibraryItem, kind: TopTab) => void;
  /** Optional close handler. When provided, renders an × on the right
   *  side of the top-tab row so the panel doesn't need an outer header. */
  onClose?: () => void;
}

const LIBRARY_PAGE_SIZE = 30;
const FREESOUND_PAGE_SIZE = 24;
// On empty-query Music tab open: if the library returns fewer than
// this many tracks, auto-fetch default Freesound music so new users
// have something to browse. Above this, library is the home view and
// we skip the Freesound roundtrip (faster, no API quota).
const LIBRARY_HOME_THRESHOLD = 10;

export default function SFXBrowserPanel({ onPick, onClose }: SFXBrowserPanelProps) {
  const [topTab, setTopTab] = useState<TopTab>('sfx');
  const [query, setQuery] = useState('');

  const [libraryItems, setLibraryItems] = useState<SfxLibraryItem[]>([]);
  const [libraryOffset, setLibraryOffset] = useState(0);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);

  const [freesoundItems, setFreesoundItems] = useState<SfxLibraryItem[]>([]);
  const [freesoundPage, setFreesoundPage] = useState(1);
  const [freesoundExhausted, setFreesoundExhausted] = useState(false);
  const [freesoundLoading, setFreesoundLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [importingExternalId, setImportingExternalId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const fetchLibraryPage = useCallback(
    async (offset: number, tab: TopTab, q: string, replace: boolean): Promise<SfxLibraryItem[]> => {
      setLibraryLoading(true);
      try {
        const url = new URL('/api/v1/sfx-library', window.location.origin);
        url.searchParams.set('kind', tab);
        url.searchParams.set('limit', String(LIBRARY_PAGE_SIZE));
        url.searchParams.set('offset', String(offset));
        if (q.trim()) url.searchParams.set('q', q.trim());
        const res = await fetch(url.toString());
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const incoming: SfxLibraryItem[] = data.sounds ?? [];
        setLibraryItems((prev) => (replace ? incoming : [...prev, ...incoming]));
        setLibraryHasMore(!!data.hasMore);
        setLibraryOffset(offset + incoming.length);
        return incoming;
      } catch (err: any) {
        setError(err.message || 'Library query failed');
        return [];
      } finally {
        setLibraryLoading(false);
      }
    },
    [],
  );

  const fetchFreesoundPage = useCallback(
    async (page: number, tab: TopTab, q: string, replace: boolean) => {
      if (q.trim().length < 2) {
        setFreesoundItems([]);
        setFreesoundExhausted(true);
        return;
      }
      setFreesoundLoading(true);
      try {
        const url = new URL('/api/v1/sfx-library/freesound', window.location.origin);
        url.searchParams.set('q', q.trim());
        url.searchParams.set('pageSize', String(FREESOUND_PAGE_SIZE));
        url.searchParams.set('page', String(page));
        url.searchParams.set('kind', tab);
        const res = await fetch(url.toString());
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const incoming: SfxLibraryItem[] = data.sounds ?? [];
        setFreesoundItems((prev) => (replace ? incoming : [...prev, ...incoming]));
        // Heuristic: fewer than requested = no more pages.
        setFreesoundExhausted(incoming.length < FREESOUND_PAGE_SIZE);
      } catch (err: any) {
        setError(err.message || 'Freesound search failed');
        setFreesoundExhausted(true);
      } finally {
        setFreesoundLoading(false);
      }
    },
    [],
  );

  // Single effect for both tab and query changes — collapsing them
  // prevents the double-fetch flicker that happened when both effects
  // fired on initial mount. Debounced 350ms on keystroke; immediate
  // when query is empty (tab open or query cleared).
  //
  // Freesound fetch policy:
  //   - Search mode (user typed ≥2 chars): always fetch Freesound for
  //     discovery, alongside library results.
  //   - Empty query + library has plenty (≥ LIBRARY_HOME_THRESHOLD):
  //     skip Freesound — library is the home view.
  //   - Empty query + sparse library (< threshold): fetch default
  //     Freesound results so new users see something. This is the
  //     "first-run discovery" path; once the library grows, it tapers
  //     off naturally.
  useEffect(() => {
    const t = setTimeout(async () => {
      setError(null);
      setLibraryItems([]);
      setLibraryOffset(0);
      setLibraryHasMore(false);
      setFreesoundItems([]);
      setFreesoundPage(1);

      // Always fetch library first so we know the count before deciding
      // whether to auto-fetch Freesound.
      const libraryResults = await fetchLibraryPage(0, topTab, query, true);

      if (query.trim().length >= 2) {
        setFreesoundExhausted(false);
        void fetchFreesoundPage(1, topTab, query, true);
      } else if (topTab === 'music' && libraryResults.length < LIBRARY_HOME_THRESHOLD) {
        // Sparse music library → auto-fetch default Freesound popular
        // music so the panel isn't empty for new users.
        setFreesoundExhausted(false);
        void fetchFreesoundPage(1, topTab, 'instrumental', true);
      } else {
        // Either Sounds tab with no query, or Music tab with a
        // well-stocked library. Don't auto-fetch Freesound — saves
        // API quota and lets imports be the home view.
        setFreesoundExhausted(true);
      }
    }, query ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topTab, query]);

  // Reset the query when the user switches tabs — different vocabulary
  // for sounds vs music. Pure setter; the combined effect above picks up
  // the topTab + query change in a single batched render.
  const switchTab = (next: TopTab) => {
    setTopTab(next);
    setQuery('');
  };

  // Infinite scroll — observe a sentinel near the list bottom. When it
  // enters the viewport, fetch the next chunk from whichever source still
  // has results: library first, then Freesound.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (libraryLoading || freesoundLoading) return;
        if (libraryHasMore) {
          void fetchLibraryPage(libraryOffset, topTab, query, false);
        } else if (!freesoundExhausted) {
          // Use the same effective query as the first-page fetch — for
          // the music default-state (no user query), keep paginating
          // the 'instrumental' results we showed initially.
          const effectiveQuery = query.trim().length >= 2
            ? query
            : (topTab === 'music' ? 'instrumental' : '');
          if (!effectiveQuery) return;
          const nextPage = freesoundPage + 1;
          setFreesoundPage(nextPage);
          void fetchFreesoundPage(nextPage, topTab, effectiveQuery, false);
        }
      },
      { rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [libraryLoading, freesoundLoading, libraryHasMore, libraryOffset, freesoundExhausted, freesoundPage, topTab, query, fetchLibraryPage, fetchFreesoundPage]);

  // Stop preview audio on unmount.
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
    if (sound.source === 'freesound' && sound.external_id) {
      setImportingExternalId(sound.external_id);
      try {
        const res = await fetch('/api/v1/sfx-library/freesound/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            freesoundId: Number(sound.external_id),
            kind: topTab,
          }),
        });
        // Handle non-JSON responses gracefully. Vercel returns an HTML
        // error page (starting with "An error occurred...") on function
        // timeout or crash; raw `.json()` throws an unhelpful
        // SyntaxError that surfaces as cryptic alert text.
        const contentType = res.headers.get('content-type') ?? '';
        let data: any = {};
        if (contentType.includes('application/json')) {
          data = await res.json().catch(() => ({}));
        }
        if (!res.ok) {
          const msg = data.error
            || (res.status === 504 || res.status === 503
                ? 'Import timed out — Freesound or our storage took too long. Try a shorter track, or try again.'
                : `Server returned ${res.status}`);
          alert(`Import failed: ${msg}`);
          return;
        }
        if (!data.sound) {
          alert('Import succeeded but the server returned no sound data. Try again.');
          return;
        }
        onPick({ ...data.sound, kind: topTab }, topTab);
      } catch (err: any) {
        alert(`Import failed: ${err.message || 'Network error'}`);
      } finally {
        setImportingExternalId(null);
      }
    } else {
      onPick({ ...sound, kind: topTab }, topTab);
    }
  };

  const renderRow = (s: SfxLibraryItem) => {
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
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
        </button>
      </li>
    );
  };

  const hasAnyResult = libraryItems.length + freesoundItems.length > 0;
  const showFreesoundSubhead = freesoundItems.length > 0;

  return (
    <div className="flex flex-col h-full">
      <audio ref={audioRef} onEnded={() => setPreviewingId(null)} />
      {/* Top tabs — the panel's only header. The × on the right closes
          the whole rail (the LeftRail's outer header is hidden when an
          onClose is wired here, saving ~40px of vertical real estate). */}
      <div className="px-3 pt-2 border-b border-gray-100 flex-shrink-0 flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => switchTab('sfx')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              topTab === 'sfx'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Sounds
          </button>
          <button
            onClick={() => switchTab('music')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              topTab === 'music'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Music
          </button>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="p-1 mr-1 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-gray-100 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={topTab === 'music' ? 'Search music…' : 'Search sounds…'}
          className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          aria-label="Search"
        />
      </div>

      {/* Body — scrollable list. scrollbar-thin-always keeps the track
          visible on macOS where the OS otherwise auto-hides it. */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin-always px-3 py-2 relative">
        {error && (
          <div role="alert" className="p-2 bg-red-50 text-red-700 text-xs rounded-md mb-2">
            {error}
          </div>
        )}
        {!hasAnyResult && !libraryLoading && !freesoundLoading && (
          <div className="text-center py-10 px-2">
            <p className="text-gray-700 text-sm font-medium mb-1">
              {topTab === 'music' ? 'No music yet' : 'No sounds yet'}
            </p>
            <p className="text-xs text-gray-500">
              {query.trim().length >= 2
                ? 'Try a different search — Freesound looks for CC0 matches.'
                : query.trim().length > 0
                  ? 'Type at least 2 letters to search Freesound.'
                  : (topTab === 'music'
                      ? 'Search to find background music from Freesound.'
                      : 'Search to discover sounds.')}
            </p>
          </div>
        )}
        {hasAnyResult && (
          <ul className="flex flex-col">
            {libraryItems.map(renderRow)}
            {showFreesoundSubhead && (
              <li
                className="px-1.5 pt-3 pb-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold"
                aria-hidden
              >
                More from Freesound
              </li>
            )}
            {freesoundItems.map(renderRow)}
          </ul>
        )}
        {(libraryLoading || freesoundLoading) && (
          <div className="absolute top-2 right-3 text-[10px] text-gray-400 bg-white/80 px-2 py-0.5 rounded-full">
            {freesoundLoading ? 'Searching Freesound…' : 'Loading…'}
          </div>
        )}
        {/* Infinite-scroll sentinel — observed by IntersectionObserver. */}
        <div ref={sentinelRef} aria-hidden className="h-2" />
      </div>
    </div>
  );
}
