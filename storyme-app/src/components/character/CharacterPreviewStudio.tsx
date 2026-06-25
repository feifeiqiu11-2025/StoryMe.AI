'use client';

/**
 * CharacterPreviewStudio — shared character-preview generator used by both
 * define-character paths (story builder CharacterFormModal + Characters page).
 *
 * Mirrors the chapter-book "Create New" UX:
 *   pick a style → Generate → Refine (delta edit) or Regenerate →
 *   rolling 2-up compare (older LEFT, newer RIGHT) → pick one → onPick().
 *
 * Endpoints (reused, not rebuilt):
 *   - initial generate / regenerate → POST /api/generate-character-preview
 *     (single style; all 5 styles supported)
 *   - refine (delta edit on top of a preview) → POST /api/v1/editor/generate-image
 *     (previousImageUrl + artStyle + imageProvider)
 *
 * Counter: 6 attempts per modal session, shared across edits AND regenerates.
 * The first Generate is free; everything after decrements. Failures don't count.
 * It is a UX budget only — real cost control is the server-side
 * checkImageGenerationLimit on both endpoints.
 */

import { useState, useEffect } from 'react';
import { Check, ChevronDown, Pencil, X, Loader2 } from 'lucide-react';
import { ART_STYLES, type ArtStyleType } from '@/lib/art-styles-config';
import {
  VISIBLE_IMAGE_PROVIDER_OPTIONS,
  type ImageProvider,
  type SubjectType,
  type ImageMedium,
} from '@/lib/types/story';

const MAX_ATTEMPTS = 6;

export interface CharacterPreviewInput {
  name: string;
  mode: 'photo' | 'description';
  referenceImageUrl?: string;
  characterType?: string;
  subjectType?: SubjectType;
  medium?: ImageMedium;
  description: {
    hairColor?: string;
    skinTone?: string;
    age?: string;
    otherFeatures?: string;
  };
}

interface PreviewSlot {
  url: string;
  style: ArtStyleType;
}

interface CharacterPreviewStudioProps {
  input: CharacterPreviewInput;
  /** Default model. Defaults to Gemini / Nano Banana 2. */
  initialProvider?: ImageProvider;
  /** Seed an existing preview when editing a character. */
  initialPreviewUrl?: string;
  initialStyle?: ArtStyleType;
  /**
   * Fires whenever the currently-selected preview changes (new generation,
   * edit, or the kid switching between the compare cards). There is no explicit
   * "use this" step — the parent saves on its own button, and the latest/selected
   * preview is always the one in play. Defaults to the newest image.
   */
  onPick: (result: { url: string; style: ArtStyleType }) => void;
  /** Disable generation (e.g. name/photo not ready). */
  disabled?: boolean;
  disabledReason?: string;
}

export function CharacterPreviewStudio({
  input,
  initialProvider = 'gemini-3.1',
  initialPreviewUrl,
  initialStyle = 'classic',
  onPick,
  disabled = false,
  disabledReason,
}: CharacterPreviewStudioProps) {
  const [style, setStyle] = useState<ArtStyleType>(initialStyle);
  const [provider, setProvider] = useState<ImageProvider>(initialProvider);

  // Rolling 2-up: slotA = older (left), slotB = newer (right).
  const [slotA, setSlotA] = useState<PreviewSlot | null>(
    initialPreviewUrl ? { url: initialPreviewUrl, style: initialStyle } : null
  );
  const [slotB, setSlotB] = useState<PreviewSlot | null>(null);
  const [selected, setSelected] = useState<'A' | 'B'>('A');

  const [editText, setEditText] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  // First generate is free; everything after decrements the shared budget.
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);

  const hasPreview = !!slotA;
  const selectedSlot = selected === 'B' && slotB ? slotB : slotA;

  // Keep the parent in sync with the selected/latest preview, so its own Save
  // button persists the right image without an explicit "use this" click.
  useEffect(() => {
    if (selectedSlot) onPick({ url: selectedSlot.url, style: selectedSlot.style });
    // onPick is an inline parent callback; intentionally excluded from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSlot?.url, selectedSlot?.style]);
  const outOfAttempts = hasGeneratedOnce && attemptsLeft <= 0;
  const canGenerate = !busy && !disabled && !limitReached && !outOfAttempts;
  const canRefine = hasPreview && !busy && !disabled && !limitReached && !outOfAttempts;

  /** Push a new image into the rolling slots: current keeper → left, new → right. */
  function pushResult(url: string, usedStyle: ArtStyleType) {
    const current = selected === 'B' && slotB ? slotB : slotA;
    const next: PreviewSlot = { url, style: usedStyle };
    if (!current) {
      setSlotA(next);
      setSlotB(null);
      setSelected('A');
    } else {
      setSlotA(current); // older keeper on the left
      setSlotB(next); // newer result on the right
      setSelected('B');
    }
  }

  function consumeAttempt() {
    if (!hasGeneratedOnce) {
      setHasGeneratedOnce(true); // first generate is free
      return;
    }
    setAttemptsLeft((n) => Math.max(0, n - 1));
  }

  function handleLimit(data: { error?: string }) {
    setLimitReached(true);
    setError(data.error || 'You have reached your image limit.');
  }

  /** Initial generate or full regenerate from the current description + style. */
  async function runGenerate() {
    if (!canGenerate) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: input.name,
        style,
        imageProvider: provider,
        description: input.description,
      };
      if (input.mode === 'photo') {
        body.referenceImageUrl = input.referenceImageUrl;
        if (input.subjectType) body.subjectType = input.subjectType;
        if (input.medium) body.medium = input.medium;
      } else {
        body.characterType = input.characterType;
      }

      const res = await fetch('/api/generate-character-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 429) return handleLimit(data);
      if (!res.ok || !data?.preview?.imageUrl) {
        throw new Error(data?.error || 'Could not generate a preview. Please try again.');
      }
      pushResult(data.preview.imageUrl, style);
      consumeAttempt();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a preview.');
    } finally {
      setBusy(false);
    }
  }

  /** Refine the selected preview with a small change (image-to-image edit). */
  async function runRefine() {
    if (!canRefine || !editText.trim() || !selectedSlot) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/editor/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          previousImageUrl: selectedSlot.url,
          prompt: editText.trim(),
          artStyle: style,
          imageProvider: provider,
        }),
      });
      const data = await res.json();
      if (res.status === 429) return handleLimit(data);
      if (!res.ok || !data?.image?.url) {
        throw new Error(data?.error || 'Could not apply that change. Please try again.');
      }
      pushResult(data.image.url, style);
      setEditText('');
      consumeAttempt();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not apply that change.');
    } finally {
      setBusy(false);
    }
  }

  const attemptsChip = hasGeneratedOnce ? (
    <span
      className="text-xs font-medium text-gray-500"
      aria-live="polite"
    >
      {attemptsLeft} change{attemptsLeft === 1 ? '' : 's'} left
    </span>
  ) : null;

  // Spinner shown over the image area while generating/refining (instead of a
  // "Working…" button label, which reads oddly).
  const busyOverlay = (
    <div className="absolute inset-0 rounded-lg bg-white/65 flex items-center justify-center">
      <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
        <Loader2 className="w-5 h-5 animate-spin" /> Generating…
      </span>
    </div>
  );

  // Compact edit panel — only appears after the kid taps the pencil overlay, so
  // we don't nudge them to keep changing. Sits to the right of the preview.
  const editPanel = editOpen ? (
    <div className="w-full sm:w-64 shrink-0 rounded-lg border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Make a small change</p>
        <button
          type="button"
          onClick={() => setEditOpen(false)}
          aria-label="Close"
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {outOfAttempts ? (
        <p className="text-xs text-gray-500">No changes left for this character.</p>
      ) : (
        <>
          <textarea
            autoFocus
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="e.g. add a red hat"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
          />
          <p className="text-xs text-gray-400">Small tweaks work best — a color, a hat, an expression.</p>
          <button
            type="button"
            onClick={runRefine}
            disabled={!canRefine || !editText.trim()}
            className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Make change
          </button>
        </>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-4">
      {/* Section title */}
      <h3 className="text-lg font-semibold text-gray-900">Character Preview</h3>

      {/* Controls row: pickers → Generate → counter (natural left-to-right flow) */}
      <div className="flex items-end gap-3 flex-wrap">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">Art style</span>
          <div className="relative">
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value as ArtStyleType)}
              className="appearance-none cursor-pointer border border-gray-300 rounded-lg pl-3 pr-8 h-10 text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {ART_STYLES.map((s) => (
                <option key={s.id} value={s.id} title={s.description}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gray-500">Image model</span>
          <div className="relative">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as ImageProvider)}
              className="appearance-none cursor-pointer border border-gray-300 rounded-lg pl-3 pr-8 h-10 text-sm bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            >
              {VISIBLE_IMAGE_PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </label>

        <button
          type="button"
          onClick={runGenerate}
          disabled={!canGenerate}
          className="h-10 px-5 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          {hasPreview ? 'Regenerate' : 'Generate'}
        </button>

        {attemptsChip}
        {disabled && disabledReason && (
          <span className="text-xs text-gray-500 pb-2">{disabledReason}</span>
        )}
      </div>

      {/* Preview area — left-aligned image with a subtle pencil overlay to edit;
          the edit panel opens to the right (keeps the right column useful). */}
      {slotA && slotB ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-700">Pick the one you like</p>
          <div className="flex gap-4 items-start flex-wrap">
            <div className="relative grid grid-cols-2 gap-3 min-w-[260px] max-w-md flex-1">
              <CompareCard
                label="Previous"
                slot={slotA}
                selected={selected === 'A'}
                onSelect={() => setSelected('A')}
                onEdit={canRefine ? () => { setSelected('A'); setEditOpen(true); } : undefined}
              />
              <CompareCard
                label="Updated"
                slot={slotB}
                selected={selected === 'B'}
                onSelect={() => setSelected('B')}
                onEdit={canRefine ? () => { setSelected('B'); setEditOpen(true); } : undefined}
              />
              {busy && busyOverlay}
            </div>
            {editPanel}
          </div>
        </div>
      ) : slotA ? (
        <div className="flex gap-4 items-start flex-wrap">
          <div className="relative inline-block rounded-lg border border-gray-200 p-2 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slotA.url}
              alt={`${input.name} preview`}
              className="max-h-64 object-contain rounded-md bg-white"
            />
            {canRefine && (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                title="Make a small change"
                aria-label="Make a small change"
                className="absolute top-3 right-3 bg-white/90 border border-gray-200 rounded-full p-1.5 shadow-sm hover:bg-white transition-colors"
              >
                <Pencil className="w-4 h-4 text-gray-600" />
              </button>
            )}
            {busy && busyOverlay}
          </div>
          {editPanel}
        </div>
      ) : (
        <div className="relative rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-gray-400 text-sm min-h-[120px] flex items-center justify-center">
          {busy ? (
            <span className="inline-flex items-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" /> Generating…
            </span>
          ) : (
            'Pick an art style and tap Generate to see your character.'
          )}
        </div>
      )}

      {error && (
        <div role="alert" aria-live="assertive" className="text-sm text-red-600">
          {error}
        </div>
      )}
    </div>
  );
}

function CompareCard({
  label,
  slot,
  selected,
  onSelect,
  onEdit,
}: {
  label: string;
  slot: PreviewSlot;
  selected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
}) {
  return (
    <div
      className={`relative rounded-lg border-2 p-2 bg-white transition-all ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="block w-full text-left">
        <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slot.url} alt={`${label} preview`} className="w-full max-h-56 object-contain rounded-md" />
      </button>
      {selected && (
        <span className="absolute top-2 right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
          <Check className="w-4 h-4" />
        </span>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          title="Make a small change"
          aria-label="Make a small change"
          className="absolute top-2 left-2 bg-white/90 border border-gray-200 rounded-full p-1 shadow-sm hover:bg-white transition-colors"
        >
          <Pencil className="w-3.5 h-3.5 text-gray-600" />
        </button>
      )}
    </div>
  );
}
