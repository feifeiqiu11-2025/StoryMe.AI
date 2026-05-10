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

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { X, Search } from 'lucide-react';

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

export function CharacterPickerModal(props: Props) {
  const { open, onClose, title } = props;
  const [tab, setTab] = useState<Tab>('mine');
  const [search, setSearch] = useState('');
  const [mineRows, setMineRows] = useState<PickerCharacter[] | null>(null);
  const [commRows, setCommRows] = useState<PickerCharacter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch on open. Both lists are tiny (rows, not images) so loading both
  // up front keeps tab-switching instant.
  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    const fetchAll = async () => {
      try {
        const [{ data: mineData, error: mineErr }, { data: commData, error: commErr }] = await Promise.all([
          supabase
            .from('character_library')
            .select('id, name, animated_preview_url, reference_image_url, is_favorite, updated_at')
            .order('is_favorite', { ascending: false })
            .order('updated_at', { ascending: false }),
          supabase
            .from('character_library')
            .select('id, name, animated_preview_url, reference_image_url')
            .eq('is_public', true)
            .order('updated_at', { ascending: false })
            .limit(60),
        ]);
        if (mineErr) throw mineErr;
        if (commErr) {
          // Community list can fail silently — community tab is optional.
          console.warn('Community characters load failed:', commErr);
        }

        type DbRow = {
          id: string;
          name: string;
          animated_preview_url: string | null;
          reference_image_url: string | null;
        };
        setMineRows(
          (mineData ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            imageUrl: (r as DbRow).animated_preview_url ?? (r as DbRow).reference_image_url ?? null,
            source: 'mine',
          }))
        );
        setCommRows(
          (commData ?? []).map((r) => ({
            id: r.id,
            name: r.name,
            imageUrl: (r as DbRow).animated_preview_url ?? (r as DbRow).reference_image_url ?? null,
            source: 'community',
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load characters.');
      }
    };
    void fetchAll();
  }, [open]);

  // Reset search when re-opened so each session feels fresh.
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const filtered = useMemo(() => {
    const rows = tab === 'mine' ? mineRows : commRows;
    if (!rows) return null;
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [tab, mineRows, commRows, search]);

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
