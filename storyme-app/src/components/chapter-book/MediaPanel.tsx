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

type Tab = 'characters' | 'generate' | 'upload';

interface PickOptions {
  alt?: string;
}

interface MediaPanelProps {
  onPick: (url: string, options?: PickOptions) => void;
}

interface CharacterRow {
  id: string;
  name: string;
  animated_preview_url: string | null;
  reference_image_url: string | null;
}

export function MediaPanel({ onPick }: MediaPanelProps) {
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
              ['upload', 'Upload'],
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
        {tab === 'upload' && <UploadTab onPick={onPick} />}
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

// ── Upload ─────────────────────────────────────────────────────────────

interface UploadResult {
  url: string;
  filename: string;
}

function UploadTab({ onPick }: { onPick: MediaPanelProps['onPick'] }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirror the Generate tab's preview-then-confirm pattern: upload → show
  // thumbnail → kid decides whether to insert. Avoids accidental inserts
  // and gives a chance to back out if they picked the wrong file.
  const [pending, setPending] = useState<UploadResult | null>(null);

  const upload = useCallback(
    async (file: File) => {
      if (uploading) return;
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
        setPending({ url: data.image.url, filename: file.name });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [uploading]
  );

  return (
    <div className="space-y-3">
      <label
        htmlFor="image-upload"
        className={`flex flex-col items-center justify-center min-h-[120px] border-2 border-dashed border-gray-300 rounded-lg cursor-pointer transition-colors ${
          uploading ? 'bg-gray-50' : 'hover:border-blue-400 hover:bg-blue-50/30'
        }`}
      >
        {uploading ? (
          <>
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mb-2"
              role="status"
              aria-label="Uploading"
            />
            <span className="text-xs text-gray-600">Uploading…</span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium text-gray-700">Tap to pick a photo</span>
            <span className="text-[11px] text-gray-500 mt-1">JPG, PNG, HEIC up to 10 MB</span>
          </>
        )}
        <input
          id="image-upload"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
          disabled={uploading}
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}

      {pending && (
        <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
          <p className="text-xs font-semibold text-gray-700 truncate">
            How does it look?
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pending.url}
            alt={pending.filename}
            className="w-full max-h-48 object-contain rounded bg-white"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onPick(pending.url, { alt: pending.filename });
                setPending(null);
              }}
              className="flex-1 min-h-[36px] bg-blue-600 text-white font-semibold rounded-lg text-sm hover:bg-blue-700"
            >
              Use it
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="px-3 min-h-[36px] border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-white"
            >
              Throw it away
            </button>
          </div>
        </div>
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
