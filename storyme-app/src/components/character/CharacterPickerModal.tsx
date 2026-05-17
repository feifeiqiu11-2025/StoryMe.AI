/**
 * CharacterPickerModal — shared character library picker.
 *
 * Used by:
 *   - Picture-book create flow ("Import from Character Library")
 *   - Chapter-book MediaPanel Characters tab (single-select insert)
 *   - Chapter-book Generate tab "Use characters" (multi-select reference)
 *
 * Two modes:
 *   - 'single'  click a character → onPick(character), modal closes
 *   - 'multi'   toggle characters → onChange + onConfirm("Done")
 *
 * Both modes get a search field (filters by name across both tabs) and
 * a My Characters / Community split inherited from the original inline
 * modal so prior users see the same shape.
 *
 * Self-fetches its own data via the Supabase client; callers don't need
 * to pre-load. excludeIds / disabledIds let the picture-book flow signal
 * already-imported characters.
 */

'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { X, Search } from 'lucide-react';

/** How many "My Characters" rows we load per request. Past ~50 cards
 *  the React mount cost is the bottleneck on slower devices (a user
 *  with 400+ characters reported the picker hanging on open). The
 *  community tab stays capped at 60 since it's already short. */
const MINE_PAGE_SIZE = 60;

/** Debounce the search box so we don't fire a query on every keystroke
 *  — kid typing "dragon" should produce one request, not seven. */
const SEARCH_DEBOUNCE_MS = 250;

/** Hard cap on server-side search results. Search is meant to narrow
 *  things down, not return the whole library. */
const SEARCH_RESULT_LIMIT = 100;

export interface PickerCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
  source: 'mine' | 'community';
}

type Tab = 'mine' | 'community';

interface BaseProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** IDs that should appear "Already added" / disabled (single mode). */
  alreadyAddedIds?: string[];
  /** Custom CTA label per card. Receives whether the row is already added. */
  itemCtaLabel?: (alreadyAdded: boolean) => string;
}

interface SingleModeProps extends BaseProps {
  mode: 'single';
  onPick: (character: PickerCharacter) => void;
}

interface MultiModeProps extends BaseProps {
  mode: 'multi';
  selectedIds: Set<string>;
  /** Receives the full character (so callers can render chips with name +
      avatar without re-fetching) and whether it just turned on or off. */
  onToggle: (character: PickerCharacter, on: boolean) => void;
  onConfirm: () => void;
  maxSelections?: number;
}

type Props = SingleModeProps | MultiModeProps;

type DbRow = {
  id: string;
  name: string;
  animated_preview_url: string | null;
  reference_image_url: string | null;
};

function toPicker(r: DbRow, source: 'mine' | 'community'): PickerCharacter {
  return {
    id: r.id,
    name: r.name,
    imageUrl: r.animated_preview_url ?? r.reference_image_url ?? null,
    source,
  };
}

export function CharacterPickerModal(props: Props) {
  const { open, onClose, title } = props;
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  // "My Characters" browse-mode state. Paginated via the sentinel below.
  // We split browse-mode rows from search-mode rows so clearing the
  // search box doesn't lose the scroll position the kid built up.
  const [mineRows, setMineRows] = useState<PickerCharacter[] | null>(null);
  const [hasMoreMine, setHasMoreMine] = useState(true);
  const [loadingMoreMine, setLoadingMoreMine] = useState(false);
  // Search-mode results live separately so we can swap them in/out
  // without disturbing the paginated browse state.
  const [searchRows, setSearchRows] = useState<PickerCharacter[] | null>(null);
  const [searching, setSearching] = useState(false);
  // Community list is small (≤60) and already capped — single fetch,
  // client-side search filter is plenty.
  const [commRows, setCommRows] = useState<PickerCharacter[] | null>(null);
  // Resolved on open. RLS lets us SELECT public rows from other users, so
  // the "Mine" queries must filter user_id = uid explicitly — otherwise
  // public characters from other users leak in here.
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped each time the modal opens; effects compare against the
  // captured value before committing state to avoid stale-response races
  // (kid opens, closes, reopens before the first fetch returns).
  const requestKey = useRef(0);
  const isSearching = search.trim().length > 0;

  // Initial fetch on open: first page of My Characters + the small
  // Community list. No more "pull everything in one shot."
  useEffect(() => {
    if (!open) return;
    requestKey.current += 1;
    const myKey = requestKey.current;
    const supabase = createClient();
    setMineRows(null);
    setHasMoreMine(true);
    setSearchRows(null);

    const fetchInitial = async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (myKey !== requestKey.current) return;
        if (userErr) throw userErr;
        const uid = userData.user?.id ?? null;
        setUserId(uid);

        const minePromise = uid
          ? supabase
              .from('character_library')
              .select('id, name, animated_preview_url, reference_image_url, is_favorite, updated_at')
              .eq('user_id', uid)
              .order('is_favorite', { ascending: false })
              .order('updated_at', { ascending: false })
              .range(0, MINE_PAGE_SIZE - 1)
          : Promise.resolve({ data: [], error: null } as const);

        const [{ data: mineData, error: mineErr }, { data: commData, error: commErr }] = await Promise.all([
          minePromise,
          supabase
            .from('character_library')
            .select('id, name, animated_preview_url, reference_image_url')
            .eq('is_public', true)
            .order('updated_at', { ascending: false })
            .limit(60),
        ]);
        if (myKey !== requestKey.current) return; // stale
        if (mineErr) throw mineErr;
        if (commErr) {
          // Community list can fail silently — community tab is optional.
          console.warn('Community characters load failed:', commErr);
        }
        const mine = (mineData ?? []).map((r) => toPicker(r as DbRow, 'mine'));
        setMineRows(mine);
        setHasMoreMine(mine.length === MINE_PAGE_SIZE);
        setCommRows((commData ?? []).map((r) => toPicker(r as DbRow, 'community')));
      } catch (err) {
        if (myKey !== requestKey.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load characters.');
      }
    };
    void fetchInitial();
  }, [open]);

  // Reset search when re-opened so each session feels fresh.
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  /**
   * Load the next page of My Characters (browse mode). Called by the
   * IntersectionObserver below when the sentinel scrolls into view.
   * Guards against concurrent calls + stale modal sessions.
   */
  const loadMoreMine = useCallback(async () => {
    if (!open || isSearching || loadingMoreMine || !hasMoreMine || !mineRows || !userId) return;
    setLoadingMoreMine(true);
    const myKey = requestKey.current;
    const start = mineRows.length;
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('character_library')
        .select('id, name, animated_preview_url, reference_image_url, is_favorite, updated_at')
        .eq('user_id', userId)
        .order('is_favorite', { ascending: false })
        .order('updated_at', { ascending: false })
        .range(start, start + MINE_PAGE_SIZE - 1);
      if (myKey !== requestKey.current) return;
      if (error) throw error;
      const page = (data ?? []).map((r) => toPicker(r as DbRow, 'mine'));
      setMineRows((prev) => (prev ? [...prev, ...page] : page));
      setHasMoreMine(page.length === MINE_PAGE_SIZE);
    } catch (err) {
      if (myKey !== requestKey.current) return;
      console.warn('Load more mine failed:', err);
      setHasMoreMine(false);
    } finally {
      if (myKey === requestKey.current) setLoadingMoreMine(false);
    }
  }, [open, isSearching, loadingMoreMine, hasMoreMine, mineRows, userId]);

  /**
   * Server-side search. Client-side filter on a paginated list misses
   * characters that haven't been loaded yet — for a kid with 400+
   * characters that produces phantom "no results" failures. Debounce
   * keystrokes so we issue one query per pause, not one per character.
   */
  useEffect(() => {
    if (!open) return;
    if (!isSearching) {
      setSearchRows(null);
      return;
    }
    const q = search.trim();
    const myKey = requestKey.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      if (!userId) {
        setSearchRows([]);
        setSearching(false);
        return;
      }
      const supabase = createClient();
      try {
        const { data, error } = await supabase
          .from('character_library')
          .select('id, name, animated_preview_url, reference_image_url, is_favorite, updated_at')
          .eq('user_id', userId)
          .ilike('name', `%${q}%`)
          .order('is_favorite', { ascending: false })
          .order('updated_at', { ascending: false })
          .limit(SEARCH_RESULT_LIMIT);
        if (myKey !== requestKey.current) return;
        if (error) throw error;
        setSearchRows((data ?? []).map((r) => toPicker(r as DbRow, 'mine')));
      } catch (err) {
        if (myKey !== requestKey.current) return;
        console.warn('Search failed:', err);
        setSearchRows([]);
      } finally {
        if (myKey === requestKey.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, isSearching, search, userId]);

  const filtered = useMemo(() => {
    if (tab === 'community') {
      // Community is short, no pagination — client-side filter is fine.
      if (!commRows) return null;
      const q = search.trim().toLowerCase();
      if (!q) return commRows;
      return commRows.filter((r) => r.name.toLowerCase().includes(q));
    }
    // 'mine': either search-mode results (server-filtered) or paginated browse.
    if (isSearching) return searchRows; // null = still loading
    return mineRows;
  }, [tab, mineRows, commRows, searchRows, isSearching, search]);

  const onCardClick = useCallback(
    (character: PickerCharacter) => {
      if (props.mode === 'single') {
        props.onPick(character);
        return;
      }
      const isOn = props.selectedIds.has(character.id);
      if (!isOn && props.maxSelections != null && props.selectedIds.size >= props.maxSelections) {
        return; // hit the cap
      }
      props.onToggle(character, !isOn);
    },
    [props]
  );

  if (!open) return null;

  const headerTitle = title || 'My Characters';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">{headerTitle}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-700 p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + Tabs */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" aria-hidden />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name…"
              aria-label="Search characters"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('mine')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'mine'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              My Characters
              {mineRows ? <span className="ml-1.5 opacity-70">({mineRows.length})</span> : null}
            </button>
            <button
              type="button"
              onClick={() => setTab('community')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === 'community'
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Community
              {commRows ? <span className="ml-1.5 opacity-70">({commRows.length})</span> : null}
            </button>
          </div>
        </div>

        {/* Body — scrollable grid */}
        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <p className="text-center text-sm text-red-600 py-6">{error}</p>
          ) : !filtered ? (
            <PickerLoading />
          ) : filtered.length === 0 ? (
            <PickerEmpty tab={tab} hasSearch={!!search.trim()} />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filtered.map((c) => (
                  <PickerCard
                    key={c.id}
                    character={c}
                    mode={props.mode}
                    selected={
                      props.mode === 'multi' ? props.selectedIds.has(c.id) : false
                    }
                    alreadyAdded={(props.alreadyAddedIds ?? []).includes(c.id)}
                    ctaLabel={props.itemCtaLabel}
                    onClick={() => onCardClick(c)}
                  />
                ))}
              </div>
              {/* Infinite-scroll sentinel — only in browse-mode (no
                  search) on the My tab, only when more rows exist. */}
              {tab === 'mine' && !isSearching && hasMoreMine && (
                <InfiniteScrollSentinel
                  onIntersect={loadMoreMine}
                  loading={loadingMoreMine}
                />
              )}
              {/* Search status copy keeps the kid oriented when results
                  are capped or are still loading. */}
              {tab === 'mine' && isSearching && filtered && (
                <p className="text-center text-xs text-gray-500 mt-4">
                  {searching
                    ? 'Searching…'
                    : `Showing ${filtered.length} match${filtered.length === 1 ? '' : 'es'}${
                        filtered.length === SEARCH_RESULT_LIMIT
                          ? ` (capped — try a more specific search)`
                          : ''
                      }`}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer — Done button only in multi mode */}
        {props.mode === 'multi' && (
          <div className="flex items-center justify-between p-4 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              {props.selectedIds.size}{props.maxSelections ? ` / ${props.maxSelections}` : ''} selected
            </span>
            <button
              type="button"
              onClick={props.onConfirm}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PickerCard({
  character,
  mode,
  selected,
  alreadyAdded,
  ctaLabel,
  onClick,
}: {
  character: PickerCharacter;
  mode: 'single' | 'multi';
  selected: boolean;
  alreadyAdded: boolean;
  ctaLabel?: (alreadyAdded: boolean) => string;
  onClick: () => void;
}) {
  const label =
    mode === 'multi'
      ? selected
        ? 'Selected'
        : 'Add'
      : ctaLabel
        ? ctaLabel(alreadyAdded)
        : alreadyAdded
          ? 'Added'
          : 'Import';

  const disabled = mode === 'single' && alreadyAdded;

  return (
    <div
      className={`bg-white border-2 rounded-xl overflow-hidden transition-colors ${
        selected ? 'border-blue-500' : 'border-gray-200 hover:border-blue-300'
      }`}
    >
      <div className="aspect-square bg-gradient-to-br from-blue-100 to-purple-100 relative">
        {character.imageUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={character.imageUrl}
            alt={character.name}
            // Browser-native lazy load — only fetches when the card is
            // near the viewport. Critical for users with 100+ characters
            // since the picker pulls the full library.
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl text-gray-400">
            ?
          </div>
        )}
        {character.source === 'community' && (
          <span className="absolute top-2 right-2 bg-purple-500 text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
            Community
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className="font-semibold text-gray-900 text-sm mb-1.5 truncate">{character.name}</h3>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          className={`w-full px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            selected
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-gray-100 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
          } disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed`}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

/**
 * Tiny div that triggers a callback when it scrolls into view. We use it
 * as the bottom marker of the grid so the next page of My Characters
 * loads automatically before the kid reaches the actual end. rootMargin
 * pre-loads roughly one viewport before the sentinel is visible, so the
 * jump between pages feels seamless rather than spinning-then-content.
 *
 * Why a component instead of inline useEffect: keeps the observer
 * lifecycle scoped to a mounted/unmounted element. The sentinel is
 * conditionally rendered (search hides it), and unmount cleanly
 * disposes the observer.
 */
function InfiniteScrollSentinel({
  onIntersect,
  loading,
}: {
  onIntersect: () => void;
  loading: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback in a ref so we don't re-create the observer
  // every time the parent rerenders (which happens on every scroll-tick
  // in some browsers).
  const cb = useRef(onIntersect);
  cb.current = onIntersect;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) cb.current();
      },
      { rootMargin: '300px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className="py-6 flex items-center justify-center">
      {loading ? (
        <div
          className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"
          role="status"
          aria-label="Loading more characters"
        />
      ) : (
        // Invisible spacer when not loading — sentinel still measurable
        // by the observer but no visual noise at the bottom of the list.
        <span aria-hidden className="block h-0" />
      )}
    </div>
  );
}

function PickerLoading() {
  return (
    <div className="text-center py-12">
      <div
        className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"
        role="status"
        aria-label="Loading characters"
      />
      <p className="text-sm text-gray-500">Loading characters…</p>
    </div>
  );
}

function PickerEmpty({ tab, hasSearch }: { tab: Tab; hasSearch: boolean }) {
  if (hasSearch) {
    return <p className="text-center text-sm text-gray-500 py-12">No characters match your search.</p>;
  }
  if (tab === 'mine') {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No characters in your library yet.</p>
        <Link
          href="/characters"
          className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          Go to Character Library
        </Link>
      </div>
    );
  }
  return <p className="text-center text-sm text-gray-500 py-12">No community characters available yet.</p>;
}
