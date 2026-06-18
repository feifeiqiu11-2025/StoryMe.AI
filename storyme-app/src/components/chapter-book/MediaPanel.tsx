/**
 * MediaPanel — side panel for the chapter book editor.
 *
 * Four ways to add an image:
 *   - Characters: pick from the user's character_library via the shared
 *     CharacterPickerModal (with search + community tab)
 *   - Stickers:   pick from sticker_sheets (decompose mode)
 *   - Generate:   text prompt + 0..N character refs + optional uploaded
 *                 reference + art style + model picker → Gemini/Fal →
 *                 preview pane (Use / Save & use / Try again / Discard)
 *   - Upload:     pick a file from device → sharp-compressed → URL
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { thumbnailUrl } from '@/lib/utils/image-transform';
import {
  VISIBLE_IMAGE_PROVIDER_OPTIONS,
  DEFAULT_SCENE_IMAGE_PROVIDER,
  type ImageProvider,
} from '@/lib/types/story';
import {
  CharacterPickerModal,
  type PickerCharacter,
} from '@/components/character/CharacterPickerModal';
import { DrawingCanvas, type Stroke } from './DrawingCanvas';

type Tab = 'characters' | 'generate' | 'upload';

interface PickOptions {
  alt?: string;
}

interface MediaPanelProps {
  onPick: (url: string, options?: PickOptions) => void;
  /** Chapter book id — scopes the My Art "Recent drawings" gallery. */
  bookId: string;
}

interface CharacterRow {
  id: string;
  name: string;
  animated_preview_url: string | null;
  reference_image_url: string | null;
}

export function MediaPanel({ onPick, bookId }: MediaPanelProps) {
  const [tab, setTab] = useState<Tab>('characters');
  // Resolved once at panel mount so child tabs + picker don't each pay
  // the auth round-trip. The Supabase client caches sessions in memory,
  // but lifting the await up here also lets the picker fire its parallel
  // queries immediately on open instead of sequentially after getUser().
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-gray-200">
        <h2 className="px-4 py-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Add Pictures
        </h2>
        <div className="flex border-t border-gray-100" role="tablist">
          {(
            [
              ['characters', 'Characters'],
              ['generate', 'Create New'],
              ['upload', 'My Art'],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex-1 min-h-[44px] px-2 text-xs font-semibold transition-colors ${
                tab === key
                  ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50 border-b-2 border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 max-h-[calc(100vh-220px)] overflow-y-auto">
        {tab === 'characters' && <CharactersTab onPick={onPick} userId={userId} />}
        {tab === 'generate' && <GenerateTab onPick={onPick} userId={userId} />}
        {/* My Art stays mounted (just hidden when inactive) so an in-progress
            drawing, upload, or polish survives switching tabs — it's only
            cleared when the kid taps "Throw it away". */}
        <div className={tab === 'upload' ? '' : 'hidden'}>
          <MyArtTab onPick={onPick} bookId={bookId} />
        </div>
      </div>
    </div>
  );
}

// ── Characters ─────────────────────────────────────────────────────────

function CharactersTab({ onPick, userId }: { onPick: MediaPanelProps['onPick']; userId: string | null }) {
  const [recent, setRecent] = useState<CharacterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    // Wait until the panel has resolved the current user — RLS also
    // allows reading is_public rows from other users, so the recent
    // strip must filter explicitly or community characters leak in.
    if (!userId) return;
    const load = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('character_library')
          .select('id, name, animated_preview_url, reference_image_url')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false })
          .limit(8);
        if (error) throw error;
        setRecent((data || []) as CharacterRow[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load characters.');
      }
    };
    load();
  }, [userId]);

  if (error) return <PanelError>{error}</PanelError>;
  if (!recent) return <PanelLoading label="Loading your characters" />;

  return (
    <>
      {recent.length === 0 ? (
        <PanelEmpty>
          No characters yet.{' '}
          <a href="/characters" className="text-blue-600 hover:underline">
            Create one
          </a>{' '}
          and come back.
        </PanelEmpty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {recent.map((c) => {
              const url = c.animated_preview_url || c.reference_image_url;
              if (!url) return null;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onPick(url, { alt: c.name })}
                  className="aspect-square bg-gray-50 border border-gray-200 rounded-lg overflow-hidden hover:border-blue-400 hover:shadow-sm transition-all relative"
                  title={`Insert ${c.name}`}
                  aria-label={`Insert ${c.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl(url, 240) ?? url}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] font-medium py-1 px-1 truncate">
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full mt-3 text-xs font-semibold text-blue-700 hover:text-blue-900 py-2 rounded-lg border border-blue-200 hover:bg-blue-50"
          >
            See all my characters
          </button>
        </>
      )}

      <CharacterPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Pick a character"
        mode="single"
        itemCtaLabel={() => 'Insert'}
        userId={userId}
        onPick={(c) => {
          if (c.imageUrl) onPick(c.imageUrl, { alt: c.name });
          setPickerOpen(false);
        }}
      />
    </>
  );
}

// ── Generate ───────────────────────────────────────────────────────────

const ART_STYLE_OPTIONS: Array<{ value: 'pixar' | 'classic' | 'coloring' | ''; label: string }> = [
  { value: '', label: 'Auto' },
  { value: 'pixar', label: '3D (Pixar)' },
  { value: 'classic', label: 'Watercolor' },
  { value: 'coloring', label: 'Coloring Book' },
];

interface GenerationResult {
  url: string;
  prompt: string;
  characterIds: string[];
  artStyle: string;
}

/**
 * Parse a generate-image response, even when the server doesn't return
 * JSON. Vercel's plain-text "An error occurred" page (returned on
 * timeout or function crash) used to surface as a cryptic
 * "Unexpected token 'A'..." JSON parse error. This helper extracts a
 * useful message instead.
 */
async function parseGenerateResponse(res: Response): Promise<{ image: { url: string } }> {
  if (!res.ok) {
    const body = await res.text();
    let message = `Generation failed (${res.status})`;
    try {
      const parsed = JSON.parse(body);
      if (parsed?.error) message = parsed.error;
    } catch {
      // Body is not JSON. The Vercel timeout/crash page starts with
      // "An error occurred…" — translate to something a kid can act on.
      if (res.status === 504 || /timed?\s*out|an error occurred/i.test(body)) {
        message =
          'The picture took too long to make. Try a shorter prompt, fewer reference characters, or a different model.';
      }
    }
    throw new Error(message);
  }
  return res.json();
}

function GenerateTab({ onPick, userId }: { onPick: MediaPanelProps['onPick']; userId: string | null }) {
  const [prompt, setPrompt] = useState('');
  const [selectedChars, setSelectedChars] = useState<Map<string, PickerCharacter>>(new Map());
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [referenceUploading, setReferenceUploading] = useState(false);
  // Default to 3D Pixar — matches the picture-book default (also 'pixar')
  // so kids get a consistent first impression across the two flows.
  const [artStyle, setArtStyle] = useState<'pixar' | 'classic' | 'coloring' | ''>('pixar');
  const [imageProvider, setImageProvider] = useState<ImageProvider>(DEFAULT_SCENE_IMAGE_PROVIDER);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Two-slot comparison: slotA is the kid's anchor (first generation or
  // a kept edit), slotB is the candidate (latest edit attempt). When
  // slotB is null we render the single-image view; when both are set we
  // render side-by-side. Non-destructive — both stay until the kid
  // explicitly picks one with "Use" or "Throw it away".
  const [slotA, setSlotA] = useState<GenerationResult | null>(null);
  const [slotB, setSlotB] = useState<GenerationResult | null>(null);
  // Edit panel is collapsed by default so the kid sees a single primary
  // action ("Insert into book") rather than an inviting textbox that
  // encourages endless tweaking. Expand on click, auto-collapse after
  // a successful edit.
  const [editOpen, setEditOpen] = useState(false);
  const [editingFrom, setEditingFrom] = useState<'A' | 'B'>('A');
  const [editPrompt, setEditPrompt] = useState('');
  const [editing, setEditing] = useState(false);
  // Per-edit reference image — separate from the top-level
  // referenceImageUrl. Cleared after each successful edit so a stale
  // reference from a prior edit doesn't bleed into the next one.
  const [editReferenceImageUrl, setEditReferenceImageUrl] = useState<string | null>(null);
  const [editReferenceUploading, setEditReferenceUploading] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [savingChar, setSavingChar] = useState(false);
  // The "Save as a character" form is collapsed by default — kids who
  // just want to insert the picture don't see the name input. Expand
  // on click of the link.
  const [showSaveForm, setShowSaveForm] = useState(false);

  const uploadReference = useCallback(async (file: File) => {
    if (referenceUploading) return;
    setReferenceUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/editor/upload-image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setReferenceImageUrl(data.image.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setReferenceUploading(false);
    }
  }, [referenceUploading]);

  // Separate uploader for the per-edit reference (paperclip in the edit
  // panel) so a stale reference from an earlier edit doesn't bleed into
  // the next one.
  const uploadEditReference = useCallback(async (file: File) => {
    if (editReferenceUploading) return;
    setEditReferenceUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/v1/editor/upload-image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      setEditReferenceImageUrl(data.image.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setEditReferenceUploading(false);
    }
  }, [editReferenceUploading]);

  const generate = useCallback(async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);
    setSlotA(null);
    setSlotB(null);
    setEditOpen(false);
    setEditPrompt('');
    setEditReferenceImageUrl(null);
    try {
      const res = await fetch('/api/v1/editor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          characterIds: Array.from(selectedChars.keys()),
          referenceImageUrl: referenceImageUrl ?? undefined,
          artStyle: artStyle || undefined,
          imageProvider,
        }),
      });
      const data = await parseGenerateResponse(res);
      setSlotA({
        url: data.image.url,
        prompt: prompt.trim(),
        characterIds: Array.from(selectedChars.keys()),
        artStyle: artStyle || 'auto',
      });
      // The save-as-character form starts empty + collapsed. Don't
      // pre-fill with the prompt — that's misleading: the input is for
      // a character name, not a continuation of the prompt.
      setSaveAsName('');
      setShowSaveForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [prompt, selectedChars, referenceImageUrl, artStyle, imageProvider, generating]);

  /**
   * Run an edit based on whichever slot the kid clicked "Edit" on. The
   * source image is sent as previousImageUrl, and the result lands in
   * the OTHER slot — so both versions stay visible side-by-side for
   * comparison instead of replacing one another.
   */
  const submitEdit = useCallback(async () => {
    const source = editingFrom === 'A' ? slotA : slotB;
    if (!source || !editPrompt.trim() || editing) return;
    setEditing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/editor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: editPrompt.trim(),
          characterIds: source.characterIds,
          referenceImageUrl: editReferenceImageUrl ?? referenceImageUrl ?? undefined,
          previousImageUrl: source.url,
          artStyle: artStyle || undefined,
          imageProvider,
        }),
      });
      const data = await parseGenerateResponse(res);
      const newResult: GenerationResult = {
        url: data.image.url,
        prompt: editPrompt.trim(),
        characterIds: source.characterIds,
        artStyle: source.artStyle,
      };
      // Land in the other slot so both versions stay visible.
      if (editingFrom === 'A') setSlotB(newResult);
      else setSlotA(newResult);
      // Close the edit panel after a successful edit — keeps the kid
      // from staring at an open textbox and feeling like they have to
      // keep editing.
      setEditOpen(false);
      setEditPrompt('');
      setEditReferenceImageUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Edit failed');
    } finally {
      setEditing(false);
    }
  }, [editingFrom, slotA, slotB, editPrompt, editing, referenceImageUrl, editReferenceImageUrl, artStyle, imageProvider]);

  const openEditFor = (slot: 'A' | 'B') => {
    setEditingFrom(slot);
    setEditOpen(true);
    setEditPrompt('');
    setEditReferenceImageUrl(null);
  };

  const useSlot = (slot: 'A' | 'B') => {
    const target = slot === 'A' ? slotA : slotB;
    if (!target) return;
    onPick(target.url, { alt: target.prompt.slice(0, 80) });
    setSlotA(null);
    setSlotB(null);
    setEditOpen(false);
    setEditPrompt('');
    setEditReferenceImageUrl(null);
    setShowSaveForm(false);
    setSaveAsName('');
  };

  const throwAway = () => {
    setSlotA(null);
    setSlotB(null);
    setEditOpen(false);
    setEditPrompt('');
    setEditReferenceImageUrl(null);
    setShowSaveForm(false);
    setSaveAsName('');
  };

  // Save-as-character only appears in single-image view (slotA only,
  // no candidate), so it always saves slotA.
  const saveAndUse = useCallback(async () => {
    if (!slotA || savingChar) return;
    if (!saveAsName.trim()) return;
    setSavingChar(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/editor/save-as-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: slotA.url,
          name: saveAsName.trim(),
          prompt: slotA.prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      onPick(slotA.url, { alt: saveAsName.trim() });
      setSlotA(null);
      setSlotB(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingChar(false);
    }
  }, [slotA, saveAsName, savingChar, onPick]);

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="gen-prompt" className="block text-xs font-semibold text-gray-700 mb-1">
          What should the picture show?
        </label>
        <textarea
          id="gen-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={6}
          maxLength={500}
          placeholder="e.g. A small dragon reading a book by the river, surrounded by glowing fireflies on a summer night"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
        />
      </div>

      {/* Selected character chips + Pick button. Label is inline with
          the icon-only Pick button; selected character chips wrap below. */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-semibold text-gray-700">
            Add characters from your library
          </label>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Pick characters"
            title="Pick characters from your library"
            className="inline-flex items-center justify-center w-6 h-6 text-purple-700 hover:text-purple-900"
          >
            <PlusIcon />
          </button>
        </div>
        {selectedChars.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {Array.from(selectedChars.values()).map((c) => (
              <span
                key={c.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 border border-blue-300 text-blue-700"
              >
                {c.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbnailUrl(c.imageUrl, 64) ?? c.imageUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                )}
                {c.name}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedChars((prev) => {
                      const next = new Map(prev);
                      next.delete(c.id);
                      return next;
                    });
                  }}
                  aria-label={`Remove ${c.name}`}
                  className="ml-0.5 text-blue-500 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Reference image — label and paperclip inline. Thumbnail chip
          appears below when attached. */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-xs font-semibold text-gray-700">
            Add reference image
          </label>
          {!referenceImageUrl && (
            <label
              className={`inline-flex items-center justify-center w-6 h-6 text-purple-700 cursor-pointer hover:text-purple-900 ${
                referenceUploading ? 'opacity-50' : ''
              }`}
              title="Attach a reference sketch or photo (optional)"
              aria-label="Attach a reference sketch or photo (optional)"
            >
              <PaperclipIcon />
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={referenceUploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadReference(file);
                  e.target.value = '';
                }}
              />
            </label>
          )}
        </div>
        {referenceImageUrl && (
          <div className="flex items-center gap-2 px-2 py-1 border border-gray-200 rounded-lg bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={referenceImageUrl} alt="reference" className="w-6 h-6 rounded object-cover flex-shrink-0" />
            <span className="text-[11px] text-gray-600 truncate flex-1">Reference attached</span>
            <button
              type="button"
              onClick={() => setReferenceImageUrl(null)}
              className="text-[11px] text-gray-500 hover:text-red-600 flex-shrink-0"
            >
              Remove
            </button>
          </div>
        )}
      </div>

      {/* Art style + model (compact two-column) */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="gen-style" className="block text-xs font-semibold text-gray-700 mb-1">
            Art style
          </label>
          <select
            id="gen-style"
            value={artStyle}
            onChange={(e) => setArtStyle(e.target.value as typeof artStyle)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ART_STYLE_OPTIONS.map((s) => (
              <option key={s.value || 'auto'} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="gen-model" className="block text-xs font-semibold text-gray-700 mb-1">
            Image Model
          </label>
          <select
            id="gen-model"
            value={imageProvider}
            onChange={(e) => setImageProvider(e.target.value as ImageProvider)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {VISIBLE_IMAGE_PROVIDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        type="button"
        onClick={generate}
        disabled={generating || !prompt.trim()}
        className="w-full min-h-[44px] bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {generating ? 'Generating…' : 'Generate Picture'}
      </button>
      <p className="text-[11px] text-gray-500">
        Generating a picture takes about 20–40 seconds.
      </p>

      {/* Preview pane. Two layouts:
            - Single-image view (only slotA): anchor image with full
              action set (Insert, Save, Try again, Throw away, plus a
              collapsed "Make a small change" trigger).
            - Two-image view (slotA + slotB): side-by-side comparison,
              each image has its own Use / Edit affordance. Both stay
              visible until the kid picks one — non-destructive iteration.
          The edit panel is hidden behind an icon-trigger so kids see a
          clear primary action instead of a tempting open textbox. */}
      {slotA && !slotB && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700">How does it look?</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={slotA.url}
            alt={slotA.prompt}
            className="w-full max-h-48 object-contain rounded bg-white"
          />

          <button
            type="button"
            onClick={() => useSlot('A')}
            className="w-full min-h-[40px] bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700"
          >
            Insert into book
          </button>

          {showSaveForm ? (
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-semibold text-gray-700">
                Name this character so you can use it again later
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="e.g. Spark the dragon"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={80}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={saveAndUse}
                  disabled={savingChar || !saveAsName.trim()}
                  className="px-3 min-h-[32px] bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingChar ? 'Saving…' : 'Save & insert'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowSaveForm(false);
                  setSaveAsName('');
                }}
                className="text-[11px] text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              className="text-xs text-purple-700 hover:text-purple-900 font-medium"
            >
              + Save as a character
            </button>
          )}

          {/* Collapsed edit trigger — pencil icon + label, left-aligned.
              Click to expand the edit panel below the result. Kids can
              regenerate by editing the prompt at the top and clicking
              Generate Picture (which clears slots automatically), so
              dedicated Try-again / Throw-away buttons aren't needed
              in the single-image view. */}
          {!editOpen && (
            <button
              type="button"
              onClick={() => openEditFor('A')}
              disabled={editing || generating}
              className="w-full flex items-center gap-1.5 pt-2 mt-2 border-t border-gray-200 text-xs text-purple-700 hover:text-purple-900 font-medium disabled:opacity-50"
            >
              <PencilIcon /> Make a small change to this picture
            </button>
          )}
          {editOpen && (
            <EditPanel
              prompt={editPrompt}
              onPromptChange={setEditPrompt}
              referenceImageUrl={editReferenceImageUrl}
              onReferenceFile={(f) => void uploadEditReference(f)}
              onClearReference={() => setEditReferenceImageUrl(null)}
              referenceUploading={editReferenceUploading}
              submitting={editing}
              onSubmit={submitEdit}
              onCancel={() => {
                setEditOpen(false);
                setEditPrompt('');
                setEditReferenceImageUrl(null);
              }}
              sourceLabel="Editing this picture"
            />
          )}
        </div>
      )}

      {slotA && slotB && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Pick one or keep editing</p>
          <div className="grid grid-cols-2 gap-2">
            <SlotCard
              slot="A"
              label="Original"
              result={slotA}
              onUse={() => useSlot('A')}
              onEdit={() => openEditFor('A')}
              disabled={editing || generating}
            />
            <SlotCard
              slot="B"
              label="New edit"
              result={slotB}
              onUse={() => useSlot('B')}
              onEdit={() => openEditFor('B')}
              disabled={editing || generating}
            />
          </div>
          <button
            type="button"
            onClick={throwAway}
            className="w-full py-1.5 text-xs border border-gray-300 rounded-lg text-gray-500 hover:bg-white"
          >
            Throw both away
          </button>
          {editOpen && (
            <EditPanel
              prompt={editPrompt}
              onPromptChange={setEditPrompt}
              referenceImageUrl={editReferenceImageUrl}
              onReferenceFile={(f) => void uploadEditReference(f)}
              onClearReference={() => setEditReferenceImageUrl(null)}
              referenceUploading={editReferenceUploading}
              submitting={editing}
              onSubmit={submitEdit}
              onCancel={() => {
                setEditOpen(false);
                setEditPrompt('');
                setEditReferenceImageUrl(null);
              }}
              sourceLabel={`Editing from ${editingFrom === 'A' ? 'Original' : 'New edit'} — the new picture will replace the ${editingFrom === 'A' ? 'New edit' : 'Original'} slot`}
            />
          )}
        </div>
      )}

      {/* Picker for character references — multi-select up to 5. The
          picker passes the full PickerCharacter on toggle so the chip
          row above can render name + avatar without an extra fetch. */}
      <CharacterPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose characters as references"
        mode="multi"
        userId={userId}
        selectedIds={new Set(selectedChars.keys())}
        maxSelections={5}
        onToggle={(character, on) => {
          setSelectedChars((prev) => {
            const next = new Map(prev);
            if (on) {
              next.set(character.id, character);
            } else {
              next.delete(character.id);
            }
            return next;
          });
        }}
        onConfirm={() => setPickerOpen(false)}
      />
    </div>
  );
}

// ── Generate-tab subcomponents ────────────────────────────────────────

function PencilIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 2l1.9 5.1L19 9l-5.1 1.9L12 16l-1.9-5.1L5 9l5.1-1.9L12 2z" />
      <path d="M19 14l.9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6L19 14z" />
    </svg>
  );
}

/** Selectable image card for the original-vs-polished comparison. */
function CompareCard({
  label,
  url,
  selected,
  onSelect,
}: {
  label: string;
  url: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex flex-col gap-1 rounded-lg border-2 p-1.5 text-left transition-colors ${
        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <span className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
        <span
          className={`flex items-center justify-center w-4 h-4 rounded-full border ${
            selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300'
          }`}
          aria-hidden
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={label} className="w-full aspect-square object-contain rounded bg-white" />
    </button>
  );
}

function PaperclipIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function SlotCard({
  slot,
  label,
  result,
  onUse,
  onEdit,
  disabled,
}: {
  slot: 'A' | 'B';
  label: string;
  result: GenerationResult;
  onUse: () => void;
  onEdit: () => void;
  disabled: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-1.5 flex flex-col gap-1.5">
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider text-center">
        {label}
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={result.url}
        alt={`${label} (slot ${slot})`}
        className="w-full aspect-square object-contain rounded bg-gray-50"
      />
      <button
        type="button"
        onClick={onUse}
        disabled={disabled}
        className="w-full min-h-[28px] bg-blue-600 text-white text-[11px] font-semibold rounded hover:bg-blue-700 disabled:opacity-50"
      >
        Use this
      </button>
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        className="w-full min-h-[28px] flex items-center justify-center gap-1 text-[11px] text-purple-700 hover:text-purple-900 border border-purple-200 rounded hover:bg-purple-50 disabled:opacity-50"
      >
        <PencilIcon /> Edit
      </button>
    </div>
  );
}

interface EditPanelProps {
  prompt: string;
  onPromptChange: (s: string) => void;
  referenceImageUrl: string | null;
  onReferenceFile: (f: File) => void;
  onClearReference: () => void;
  referenceUploading: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  sourceLabel: string;
}

function EditPanel({
  prompt,
  onPromptChange,
  referenceImageUrl,
  onReferenceFile,
  onClearReference,
  referenceUploading,
  submitting,
  onSubmit,
  onCancel,
  sourceLabel,
}: EditPanelProps) {
  return (
    <div className="pt-2 mt-2 border-t border-gray-200 space-y-1.5">
      <p className="text-[11px] text-gray-600">{sourceLabel}</p>
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        rows={2}
        maxLength={500}
        placeholder="e.g. make the wolf smaller, add a moon"
        disabled={submitting}
        autoFocus
        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y disabled:bg-gray-100"
      />

      {referenceImageUrl ? (
        <div className="flex items-center gap-2 p-1.5 border border-gray-200 rounded-lg bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={referenceImageUrl}
            alt="reference"
            className="w-8 h-8 rounded object-cover"
          />
          <span className="text-[11px] text-gray-600 flex-1 truncate">
            Reference for this edit
          </span>
          <button
            type="button"
            onClick={onClearReference}
            className="text-[11px] text-gray-500 hover:text-red-600"
          >
            Remove
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <label
          className={`px-2 min-h-[32px] flex items-center justify-center text-purple-700 border border-purple-200 rounded-lg cursor-pointer hover:bg-purple-50 ${
            referenceUploading ? 'opacity-50' : ''
          }`}
          title="Attach a reference image for this edit"
          aria-label="Attach a reference image for this edit"
        >
          <PaperclipIcon />
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={referenceUploading || submitting}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onReferenceFile(file);
              e.target.value = '';
            }}
          />
        </label>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || !prompt.trim() || referenceUploading}
          className="flex-1 min-h-[32px] bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? 'Editing…' : 'Make this change'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-2 min-h-[32px] text-[11px] text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── My Art (Draw or Upload) ────────────────────────────────────────────

interface PendingArt {
  url: string;
  filename: string;
  /** True when the kid drew it here — used to tailor the card copy. */
  drawn: boolean;
}

/**
 * "My Art" tab — the kid's own artwork, two ways in:
 *   - Draw it here: full-screen DrawingCanvas → PNG → upload
 *   - Upload a photo: pick a file from device (the original Upload flow)
 *
 * Both land in the same "How does it look?" card with Use it / Throw away
 * and an optional "Save as a character" (reusing the Generate tab's
 * save-as-character endpoint). AI transformation is intentionally NOT in
 * this path — drawing is for kids who want their own art used as-is.
 */
/** An in-progress drawing the kid minimized (or finished but may re-edit). */
interface Draft {
  strokes: Stroke[];
  preview: string; // data URL, local only — not uploaded until "Done"
}

/** A saved drawing in the per-book "Recent drawings" gallery (no strokes). */
interface RecentDrawing {
  id: string;
  pngUrl: string;
  w: number;
  h: number;
  createdAt: string;
}

function MyArtTab({ onPick, bookId }: { onPick: MediaPanelProps['onPick']; bookId: string }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [pending, setPending] = useState<PendingArt | null>(null);
  // The current drawing kept across minimize / re-edit. Lives here (not in
  // DrawingCanvas) so it survives the overlay unmounting.
  const [draft, setDraft] = useState<Draft | null>(null);

  // Per-book "Recent drawings" gallery (last 10). `currentDrawingId` is the
  // saved drawing the current canvas session maps to (null = new); editing
  // a recent drawing sets it so Done updates that entry instead of adding.
  const [recent, setRecent] = useState<RecentDrawing[]>([]);
  const [currentDrawingId, setCurrentDrawingId] = useState<string | null>(null);
  // Strokes + original canvas size loaded when re-editing a saved drawing,
  // so DrawingCanvas can rescale them to the current screen.
  const [editInitial, setEditInitial] = useState<{ strokes: Stroke[]; w: number; h: number } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  // True while a just-finished drawing is being saved. Kept separate from
  // `uploading` (the photo-upload flag) so finishing a drawing doesn't show
  // "Uploading…" on the unrelated "Upload a photo" card.
  const [savingDrawing, setSavingDrawing] = useState(false);

  const loadRecent = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/chapter-books/${bookId}/drawings`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.drawings)) setRecent(data.drawings);
    } catch {
      // Non-fatal — the gallery just stays empty.
    }
  }, [bookId]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  // Save-as-character form (collapsed by default — kids who just want the
  // picture on the page never see the name input).
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savingChar, setSavingChar] = useState(false);

  // Polish: gentle AI clean-up. Non-destructive — we keep the original and
  // the polished version side by side and let the kid pick. `chosen` tracks
  // which one the downstream actions (Use it / Save) operate on.
  const [polishing, setPolishing] = useState(false);
  const [polished, setPolished] = useState<string | null>(null);
  const [chosen, setChosen] = useState<'original' | 'polished'>('original');

  // The image the action buttons act on: the picked version when a polished
  // one exists, otherwise the original upload/drawing.
  const activeUrl = polished && chosen === 'polished' ? polished : pending?.url ?? '';

  const upload = useCallback(
    async (file: File, drawn: boolean): Promise<string | null> => {
      if (uploading) return null;
      setUploading(true);
      setError(null);
      try {
        const form = new FormData();
        form.append('file', file);
        const res = await fetch('/api/v1/editor/upload-image', {
          method: 'POST',
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Upload failed');
        setPending({ url: data.image.url, filename: file.name, drawn });
        setShowSaveForm(false);
        setSaveName('');
        return data.image.url as string;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [uploading]
  );

  // Finish a drawing: upload the PNG (→ pending card) and persist the
  // editable strokes to the per-book gallery so it survives sessions and
  // can be re-edited later. New drawings get an id back; edits reuse it.
  const finishDrawing = useCallback(
    async (file: File, strokes: Stroke[], dims: { w: number; h: number }) => {
      // savingDrawing drives a spinner in the "How does it look?" card until
      // the uploaded PNG (pending) is ready — kept off the photo-upload flag.
      setSavingDrawing(true);
      try {
        const url = await upload(file, true);
        if (!url) return;
        const res = await fetch(`/api/v1/chapter-books/${bookId}/drawings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: currentDrawingId ?? undefined,
            pngUrl: url,
            strokes,
            w: dims.w,
            h: dims.h,
          }),
        });
        const data = await res.json();
        if (res.ok && data.drawing) {
          setCurrentDrawingId(data.drawing.id);
          void loadRecent();
        }
      } catch {
        // History save failed — the drawing is still usable on the page;
        // it just won't appear in Recent. Don't block the kid.
      } finally {
        setSavingDrawing(false);
      }
    },
    [upload, bookId, currentDrawingId, loadRecent]
  );

  // Open a saved drawing for editing: fetch its strokes, then launch the
  // canvas seeded with them (rescaled to the current screen size).
  const editRecent = useCallback(
    async (drawingId: string) => {
      if (loadingEdit) return;
      setLoadingEdit(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/chapter-books/${bookId}/drawings/${drawingId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Could not open drawing');
        setDraft(null);
        setPending(null);
        setPolished(null);
        setChosen('original');
        setCurrentDrawingId(drawingId);
        setEditInitial({ strokes: data.drawing.strokes ?? [], w: data.drawing.w, h: data.drawing.h });
        setDrawing(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not open drawing');
      } finally {
        setLoadingEdit(false);
      }
    },
    [bookId, loadingEdit]
  );

  const removeRecent = useCallback(
    async (drawingId: string) => {
      // Optimistic — drop it from the strip, then tell the server.
      setRecent((prev) => prev.filter((d) => d.id !== drawingId));
      try {
        await fetch(`/api/v1/chapter-books/${bookId}/drawings/${drawingId}`, { method: 'DELETE' });
      } catch {
        void loadRecent(); // resync on failure
      }
    },
    [bookId, loadRecent]
  );

  // Clears the working area (pending / draft / polish / current id). Does
  // NOT touch the Recent gallery — finished drawings stay there until the
  // kid removes them.
  const reset = () => {
    setPending(null);
    setDraft(null);
    setShowSaveForm(false);
    setSaveName('');
    setPolished(null);
    setChosen('original');
    setCurrentDrawingId(null);
    setEditInitial(null);
  };

  // Gentle AI clean-up of the kid's own art. Routes through the shared
  // generate-image endpoint with intent:'polish' (pins to GPT, preserves
  // the original style). Non-destructive: result lands beside the original.
  const polish = useCallback(async () => {
    if (!pending || polishing) return;
    setPolishing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/editor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: 'polish', previousImageUrl: pending.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Polish failed');
      setPolished(data.image.url);
      setChosen('polished');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Polish failed');
    } finally {
      setPolishing(false);
    }
  }, [pending, polishing]);

  // Save the artwork to the character library so it's reusable across
  // pages/stories, then insert it on the current page.
  const saveAsCharacter = useCallback(async () => {
    if (!pending || savingChar || !saveName.trim()) return;
    setSavingChar(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/editor/save-as-character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: activeUrl,
          name: saveName.trim(),
          prompt: 'Hand-drawn by the artist',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      onPick(activeUrl, { alt: saveName.trim() });
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavingChar(false);
    }
  }, [pending, savingChar, saveName, activeUrl, onPick]);

  return (
    <div className="space-y-3">
      {/* Two ways to add the kid's own art, shown side by side as two
          distinct option cards. Draw is accented as the primary; both
          read as equal-weight choices. Stacks on very narrow panels. */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => { setEditInitial(null); setDrawing(true); }}
          disabled={uploading}
          className="min-h-[76px] flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-blue-600 bg-blue-50 text-blue-700 font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors px-2 text-center"
        >
          <span className="flex items-center gap-1.5 text-sm">
            <PencilIcon /> Draw it here
          </span>
          <span className="text-[11px] font-normal text-blue-500">iPad or Apple Pencil</span>
        </button>

        <label
          htmlFor="image-upload"
          className={`min-h-[76px] flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-gray-200 cursor-pointer transition-colors px-2 text-center ${
            uploading ? 'bg-gray-50' : 'hover:border-blue-400 hover:bg-blue-50/30'
          }`}
        >
          {uploading && !savingDrawing ? (
            <>
              <div
                className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"
                role="status"
                aria-label="Uploading"
              />
              <span className="text-xs text-gray-600">Uploading…</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                <UploadIcon /> Upload a photo
              </span>
              <span className="text-[11px] text-gray-500">JPG, PNG, HEIC</span>
            </>
          )}
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, false);
              e.target.value = '';
            }}
            disabled={uploading}
          />
        </label>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Recent drawings (last 10 for this book). Tap to reopen and edit;
          editing reopens your drawing, not an AI-polished version. */}
      {recent.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-baseline gap-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Recent drawings
            </p>
            <span className="text-[10px] text-gray-400">your last 10 are kept here</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recent.map((d) => (
              <div key={d.id} className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => void editRecent(d.id)}
                  disabled={loadingEdit}
                  title="Tap to edit this drawing"
                  className="w-16 h-16 rounded-lg border border-gray-200 bg-white overflow-hidden hover:border-blue-400 hover:shadow-sm disabled:opacity-50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={thumbnailUrl(d.pngUrl, 128) ?? d.pngUrl}
                    alt="Recent drawing"
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </button>
                {/* Sits just inside the top-right corner so the scroll
                    container can't clip it (overflow-x makes y clip too). */}
                <button
                  type="button"
                  onClick={() => void removeRecent(d.id)}
                  aria-label="Remove from recent"
                  title="Remove"
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gray-800/80 text-white hover:bg-gray-900 shadow"
                >
                  <RemoveIcon />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minimized draft: kid stepped away from the canvas but kept the
          work. Only shown when there's a real preview image (from Minimize)
          — after Done the preview is empty (strokes kept only for "Keep
          drawing"), so this card stays hidden instead of flashing a broken
          image during the upload. */}
      {draft && draft.preview && !pending && !drawing && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/40 space-y-2">
          <p className="text-xs font-semibold text-gray-700">Your drawing is waiting</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={draft.preview}
            alt="Drawing in progress"
            className="w-full max-h-40 object-contain rounded bg-white border border-gray-100"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawing(true)}
              className="flex-1 min-h-[36px] bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700"
            >
              Continue drawing
            </button>
            <button
              type="button"
              onClick={() => setDraft(null)}
              className="px-3 min-h-[36px] border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-white"
            >
              Start over
            </button>
          </div>
        </div>
      )}

      {/* While a just-finished drawing's PNG is being prepared, show the
          "How does it look?" card with a spinner so feedback stays in the
          right place (not on the Upload card). It's quick, so no text. */}
      {savingDrawing && !pending && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700">How does it look?</p>
          <div className="w-full h-40 flex items-center justify-center rounded bg-white">
            <span
              className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"
              role="status"
              aria-label="Preparing your drawing"
            />
          </div>
        </div>
      )}

      {pending && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700 truncate">
            {polished ? 'Pick the one you like' : 'How does it look?'}
          </p>

          {polished ? (
            // Compare: original vs polished, kid taps to choose. The chosen
            // one is what Use it / Save act on. Non-destructive.
            <div className="grid grid-cols-2 gap-2">
              <CompareCard
                label="Original"
                url={pending.url}
                selected={chosen === 'original'}
                onSelect={() => setChosen('original')}
              />
              <CompareCard
                label="Polished"
                url={polished}
                selected={chosen === 'polished'}
                onSelect={() => setChosen('polished')}
              />
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={pending.url}
              alt={pending.filename}
              className="w-full max-h-48 object-contain rounded bg-white"
            />
          )}

          {/* Action buttons in a borderless 2×2 grid. Use it stays the
              clear primary (solid blue); the rest are soft tinted fills —
              no borders, lighter footprint. Polish hides once polished;
              Keep drawing only shows for an editable drawing. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onPick(activeUrl, { alt: pending.filename });
                reset();
              }}
              className="min-h-[40px] flex items-center justify-center gap-1.5 bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700"
            >
              Use it
            </button>

            {!polished && (
              <button
                type="button"
                onClick={polish}
                disabled={polishing}
                title="Gently clean up your lines — keeps your drawing's own style. Nothing is added or changed."
                className="min-h-[40px] flex items-center justify-center gap-1.5 bg-purple-50 text-purple-700 font-semibold rounded-lg text-sm hover:bg-purple-100 disabled:opacity-60"
              >
                {polishing ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600" />
                    Polishing…
                  </>
                ) : (
                  <>
                    <SparkleIcon /> Polish
                  </>
                )}
              </button>
            )}

            {/* Reopen to keep editing — covers the "tapped Done by accident"
                case. Draft strokes are kept in state. */}
            {pending.drawn && draft && (
              <button
                type="button"
                onClick={() => { setPending(null); setPolished(null); setChosen('original'); setDrawing(true); }}
                className="min-h-[40px] flex items-center justify-center gap-1.5 bg-blue-50 text-blue-700 font-semibold rounded-lg text-sm hover:bg-blue-100"
              >
                <PencilIcon /> Keep drawing
              </button>
            )}

            <button
              type="button"
              onClick={reset}
              className="min-h-[40px] flex items-center justify-center gap-1.5 bg-gray-100 text-gray-600 font-semibold rounded-lg text-sm hover:bg-gray-200"
            >
              Throw it away
            </button>
          </div>

          {/* Optional: keep this artwork as a reusable character. */}
          {showSaveForm ? (
            <div className="space-y-1.5 pt-1">
              <label className="block text-[11px] font-semibold text-gray-700">
                Name this character so you can use it again later
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="e.g. Xarian"
                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  maxLength={80}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={saveAsCharacter}
                  disabled={savingChar || !saveName.trim()}
                  className="px-3 min-h-[32px] bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingChar ? 'Saving…' : 'Save & insert'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSaveForm(true)}
              className="text-xs text-purple-700 hover:text-purple-900 font-medium"
            >
              + Save as a character
            </button>
          )}
        </div>
      )}

      {drawing && (
        <DrawingCanvas
          // Editing a saved drawing seeds from its strokes (rescaled via
          // initialCanvas); otherwise continue the in-session draft.
          initialStrokes={editInitial ? editInitial.strokes : draft?.strokes}
          initialCanvas={editInitial ? { w: editInitial.w, h: editInitial.h } : undefined}
          onClose={() => { setDrawing(false); setDraft(null); setEditInitial(null); }}
          onMinimize={(strokes, preview) => {
            // Now an in-session draft at the current canvas size — drop the
            // original-size info so it isn't rescaled again on reopen.
            setDraft({ strokes, preview });
            setEditInitial(null);
            setDrawing(false);
          }}
          onDone={(file, strokes, dims) => {
            // Keep the strokes so the kid can reopen and edit; the preview
            // is refreshed on the next minimize/done. Persist to the gallery.
            setDraft({ strokes, preview: '' });
            setEditInitial(null);
            setDrawing(false);
            void finishDrawing(file, strokes, dims);
          }}
        />
      )}
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────

function PanelLoading({ label }: { label: string }) {
  return (
    <div className="text-center py-8">
      <div
        className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"
        role="status"
        aria-label={label}
      />
      <p className="text-xs text-gray-500">{label}…</p>
    </div>
  );
}

function PanelEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-gray-500 py-4 text-center">{children}</p>;
}

function PanelError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-red-600 py-4 text-center">{children}</p>;
}
