/**
 * Draggable per-page recording panel. Content-type-agnostic — picture book,
 * chapter book, and future content types all pass in their own pages[] and
 * upload callback.
 *
 * The component owns recording state (mic, mediaRecorder, current-page index,
 * unsaved blobs, saved markers, draggable panel position) and emits a single
 * onSaveRecording callback per page save. The host decides where to upload.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { SkipBack, SkipForward, Maximize2, Minimize2, Plus, Trash2, ZoomIn, ZoomOut, Play, Pause, Music, Scissors, Loader2 } from 'lucide-react';
import WaveformTrimmer, { TrimRange, WaveformTrimmerHandle } from './WaveformTrimmer';
import SFXBrowserPanel, { SfxLibraryItem } from './SFXBrowserPanel';
import SFXTimeline from './SFXTimeline';
import LeftRail from './LeftRail';
import { TrackRow, TimelineRuler, TRACK_LABEL_WIDTH } from './TimelineLayout';
import { createMixPlayer, MixPlayer } from '@/lib/audio/preview-mix.client';
import type { VocalSegment, AudioLayers } from '@/lib/audio/layers.types';
import { mixTimeToOriginal, originalToMixTime, totalMixDuration, splitSegmentsAtMixTime } from '@/lib/audio/segment-time';
import { saveDraft as apiSaveDraft, renderFinal as apiRenderFinal, shrinkSource as apiShrinkSource } from '@/lib/audio/draft-api.client';

export interface RecordingPage {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'chapter_page' | 'quiz_transition' | 'quiz_question';
  text: string;
  textSecondary?: string;
  imageUrl?: string;
  refId?: string;
}

export interface SaveRecordingArgs {
  page: RecordingPage;
  pageIndex: number;
  blob: Blob;
  duration: number;
  language: string;
  /** When present, host should forward to server upload as `trimStart`/`trimEnd`
      FormData fields — the server's FFmpeg pipeline applies a lossless cut. */
  trim?: TrimRange;
}

export interface SaveRecordingResult {
  success: boolean;
  error?: string;
  /** Set on success — story_audio_pages row ID. Lets the recorder PATCH
      effects/music layers after the vocal upload without re-resolving. */
  audioPageId?: string;
  /** Set on success — the audio_url written by the upload. Used as the
      vocal source for the layer-mix step when SFX placements exist. */
  audioUrl?: string;
}

/** A SFX selected from the library and pending placement on the current page.
    `startSec` is the placement on the page's audio timeline; `durationSec`
    is the audible length (right-edge trim shortens it); `sourceOffsetSec`
    skips into the source file from the start (left-edge trim grows it).
    All three default to "play the whole source from time 0". */
export interface PendingEffect {
  /** Local UUID (separate from the library row's id). */
  id: string;
  sound: SfxLibraryItem;
  startSec: number;
  durationSec: number;
  sourceOffsetSec: number;
  volumeDb: number;
}

interface SecondaryLanguage {
  code: string;
  label: string;
}

interface RecorderProps {
  pages: RecordingPage[];
  defaultLanguage?: string;
  secondaryLanguage?: SecondaryLanguage;
  maxSecondsPerPage?: number;
  /** Page index the recorder opens on. Defaults to 0. */
  initialPageIndex?: number;
  /** Fires when the recorder advances/retreats — host can sync its own viewer.
      Receives both the 0-based index into `pages[]` and the page entry, so
      callers whose viewer keys off `pageNumber` (e.g. chapter book carousel,
      where blank pages create gaps) can sync without index arithmetic. */
  onPageIndexChange?: (pageIndex: number, page: RecordingPage) => void;
  /** Server-saved audio per page, keyed by 1-based pageNumber. When present,
      the recorder offers an "Edit audio" button on pages with no in-memory
      recording — clicking it pulls the saved file back as a blob so the user
      can re-trim and re-save without losing the existing work. */
  existingPageAudio?: Record<number, { audioUrl: string }>;
  /** PR 2 draft + commit metadata per page, keyed by 1-based pageNumber.
      audioPageId is the story_audio_pages row's UUID — needed to call
      /save-draft, /shrink-source, and /render. draftVocalUrl + draftLayers
      drive hydration when the user re-opens an in-progress edit. */
  existingPageDrafts?: Record<number, {
    audioPageId?: string;
    draftVocalUrl?: string | null;
    draftLayers?: AudioLayers | null;
    committedAt?: string | null;
  }>;
  onSaveRecording: (args: SaveRecordingArgs) => Promise<SaveRecordingResult>;
  onClose: () => void;
  onAllSaved?: () => void;
}

interface InMemoryRecording {
  blob: Blob;
  url: string;
  duration: number;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Pixels per second at zoom=1.0. Fixed (not derived from container width)
// so opening a side panel, resizing the modal, or adding an SFX past the
// vocal never reshuffles the clips. Auto-fit happens once per recording
// via a useEffect that sets the initial zoom; after that the user owns it.
const BASE_PX_PER_SEC = 60;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export default function Recorder({
  pages,
  defaultLanguage = 'en',
  secondaryLanguage,
  maxSecondsPerPage = 60,
  initialPageIndex = 0,
  onPageIndexChange,
  existingPageAudio,
  existingPageDrafts,
  onSaveRecording,
  onClose,
  onAllSaved,
}: RecorderProps) {
  const [currentPageIndex, setCurrentPageIndexRaw] = useState(initialPageIndex);
  const setCurrentPageIndex = (next: number | ((prev: number) => number)) => {
    setCurrentPageIndexRaw((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      if (resolved !== prev && pages[resolved]) {
        onPageIndexChange?.(resolved, pages[resolved]);
      }
      return resolved;
    });
  };
  const [pageRecordings, setPageRecordings] = useState<Map<number, InMemoryRecording>>(new Map());
  const [savedPages, setSavedPages] = useState<Set<number>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordingLanguage, setRecordingLanguage] = useState<string>(defaultLanguage);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null);
  const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  // Expanded mode = centered modal overlay with waveform trimmer; minimized
  // mode = the original draggable mini panel. Same state, different layout.
  const [expanded, setExpanded] = useState(false);
  // Per-page in-memory vocal segments. Each segment is a (start,end) window
  // in original-recording time; the mix plays them back-to-back, so a gap
  // between adjacent segments = a "cut" the user wants removed. A single
  // segment spanning [0,duration] = pristine recording. Replaces the older
  // single-trim model; the legacy outer-trim is derived as the first
  // segment's start and the last segment's end.
  const [pageVocalSegments, setPageVocalSegments] = useState<Map<number, VocalSegment[]>>(new Map());
  // Index of the currently selected voice segment within the current
  // page's segments[], or null when no voice segment is selected (e.g.,
  // when an SFX clip is selected instead).
  const [selectedVoiceSegmentIdx, setSelectedVoiceSegmentIdx] = useState<number | null>(null);
  // Per-page SFX placements pending save. Persisted via PATCH /layers after
  // the vocal upload completes (in handleSaveCurrentPage).
  const [pageEffects, setPageEffects] = useState<Map<number, PendingEffect[]>>(new Map());
  // Per-page MUSIC placements. Same shape as effects — PR 3 reuses the
  // PendingEffect type since music clips have identical fields (id, sound
  // ref, startSec, durationSec, sourceOffsetSec, volumeDb). Renders into
  // its own Music track row + corresponds to AudioLayers.music[].
  const [pageMusic, setPageMusic] = useState<Map<number, PendingEffect[]>>(new Map());
  // Per-page vocal volume in dB. Default 0 (no change). Drives the
  // Voice volume slider in the toolbar and persists into the vocal
  // layer spec on save.
  const [pageVocalVolumeDb, setPageVocalVolumeDb] = useState<Map<number, number>>(new Map());
  // Selected music clip id, mutually exclusive with selectedEffectId /
  // selectedCutIdx / selectedVoiceSegmentIdx.
  const [selectedMusicId, setSelectedMusicId] = useState<string | null>(null);
  // ID of the currently open LeftRail tab, or null for icon-strip-only mode.
  // Today only one tab exists ('sfx'); future tabs (music, AI music, voice FX)
  // will register against this same state.
  const [activeRailTab, setActiveRailTab] = useState<string | null>(null);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);
  // Shows a one-time-per-save dialog warning that vocal + SFX get burned
  // into a single mix on Save. Only opened when SFX are actually present;
  // a vocal-only save has nothing to merge so we skip the prompt entirely.
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false);

  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const panelRef = useRef<HTMLDivElement>(null);
  // Refs + state for the multi-track timeline layout (expanded view).
  // Width is measured here so SFXTimeline + WaveformTrimmer share one
  // pixelsPerSec and every clip lines up across tracks.
  const trackStackRef = useRef<HTMLDivElement>(null);
  const [trackStackWidth, setTrackStackWidth] = useState(800);
  const wavRef = useRef<WaveformTrimmerHandle>(null);
  // Mix preview state. The shared Play button creates a Web Audio mix
  // player on demand (post-user-gesture for iOS Safari), then disposes
  // when state changes invalidate the existing player.
  const mixPlayerRef = useRef<MixPlayer | null>(null);
  const [mixPlaying, setMixPlaying] = useState(false);
  const [mixLoading, setMixLoading] = useState(false);
  // Timeline zoom multiplier. `pixelsPerSec = BASE_PX_PER_SEC * zoomLevel`,
  // so this is the single source of truth for time-axis scale. On first
  // recording-load per page the auto-fit effect below sets a sensible
  // initial value; after that the user controls it via the toolbar / Cmd+/-.
  const [zoomLevel, setZoomLevel] = useState(1);
  // Tracks which page indices have already had their auto-fit applied so
  // we don't keep overriding the user's manual zoom on re-renders.
  const autoFittedPagesRef = useRef<Set<number>>(new Set());
  // Current playhead position emitted by the mix player's onProgress
  // callback. Drives the moving cursor line over the tracks; also gets
  // updated optimistically during a click/drag-to-seek gesture.
  const [mixCurrentSec, setMixCurrentSec] = useState(0);
  const [mixTotalSec, setMixTotalSec] = useState(0);
  // Local "ghost" position while scrubbing — diverges from mixCurrentSec
  // until the user releases the pointer, at which point we commit the
  // seek to the player.
  const [scrubSec, setScrubSec] = useState<number | null>(null);
  // Index of a selected "cut" (gap between adjacent voice segments).
  // Mutually exclusive with selectedEffectId — selecting one clears the
  // other. Hitting Delete with a cut selected triggers the destructive
  // commit (offline render shrinks the source blob).
  const [selectedCutIdx, setSelectedCutIdx] = useState<number | null>(null);
  const [deletingCut, setDeletingCut] = useState(false);
  // PR 2 — draft persistence tracking.
  // Per-page hash of the layer state last successfully saved to the
  // server. Dirty = current hash differs. Stable JSON.stringify so the
  // hash matches when nothing's changed.
  const lastSavedLayersHashRef = useRef<Map<number, string>>(new Map());
  // Per-page flag indicating whether the current blob has been uploaded
  // to the server as draft_vocal_url. False = the next /save-draft must
  // include the blob; true = layer-only update is enough.
  const draftBlobUploadedRef = useRef<Set<number>>(new Set());
  // Currently in-flight Save draft action (the pageIndex being saved).
  const [savingDraftPage, setSavingDraftPage] = useState<number | null>(null);
  // Per-page millisecond timestamp of the most recent successful save.
  // Drives the "Saved 5s ago" indicator in the bottom bar.
  const [draftSavedAt, setDraftSavedAt] = useState<Map<number, number>>(new Map());
  // Render in flight for Finish & Continue.
  const [renderingPage, setRenderingPage] = useState<number | null>(null);
  // Confirmation dialog when leaving a page with unsaved edits. `proceed`
  // is the navigation action the user originally tried to take; we run it
  // after Save (or Discard) resolves.
  const [navConfirm, setNavConfirm] = useState<{ proceed: () => void } | null>(null);
  // Active drag of an inner boundary between two voice segments. `side`
  // says which edge the user grabbed: 'left' = segments[boundaryIdx].endSec,
  // 'right' = segments[boundaryIdx + 1].startSec. Captured at drag start
  // and constant for the gesture so a mid-drag rescale can't reset it.
  const [voiceBoundaryDrag, setVoiceBoundaryDrag] = useState<{
    boundaryIdx: number;
    side: 'left' | 'right';
    initialOriginalSec: number;
    pointerStartX: number;
    frozenPixelsPerSec: number;
  } | null>(null);

  const totalPages = pages.length;
  const currentPage = pages[currentPageIndex];
  const currentRecording = pageRecordings.get(currentPageIndex);
  // Derive current segments — explicit list wins, otherwise default to a
  // single segment spanning the whole recording (pristine, untouched).
  // Always non-null whenever there's a recording.
  const currentSegments: VocalSegment[] = (() => {
    const explicit = pageVocalSegments.get(currentPageIndex);
    if (explicit && explicit.length > 0) return explicit;
    if (currentRecording) return [{ startSec: 0, endSec: currentRecording.duration }];
    return [];
  })();
  // "Has the user actually trimmed or split this take?" — used for the
  // unsaved badge, the Reset button, and the legacy onSaveRecording trim
  // payload. Pristine = exactly one segment spanning [0, duration].
  const isVocalEdited = currentRecording && (
    currentSegments.length > 1
    || (currentSegments.length === 1 && (
      currentSegments[0].startSec !== 0
      || currentSegments[0].endSec !== currentRecording.duration
    ))
  );
  // Legacy outer-trim shape — first segment's start, last segment's end.
  // Callers that still need a single-range view (sublabel, upload trim
  // param, mix preview legacy path) read this; multi-segment information
  // is only visible to callers that consume currentSegments directly.
  const currentTrim: TrimRange | undefined = isVocalEdited && currentSegments.length > 0
    ? { startSec: currentSegments[0].startSec, endSec: currentSegments[currentSegments.length - 1].endSec }
    : undefined;
  const currentEffects = pageEffects.get(currentPageIndex) ?? [];
  const currentMusic = pageMusic.get(currentPageIndex) ?? [];
  const currentVocalVolumeDb = pageVocalVolumeDb.get(currentPageIndex) ?? 0;
  const isLastPage = currentPageIndex === totalPages - 1;

  // Cleanup on unmount: stop recording, stop preview, release mic stream.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      pageRecordings.forEach((rec) => URL.revokeObjectURL(rec.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track-stack width measurement — used ONLY for the one-shot auto-fit
  // calculation when a new recording first appears. pixelsPerSec itself
  // is now decoupled from container width (see BASE_PX_PER_SEC), so a
  // resize after the initial fit does not rescale the clips.
  useEffect(() => {
    const el = trackStackRef.current;
    if (!el || !expanded) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 800;
      setTrackStackWidth(Math.max(400, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded]);

  // Default the Sounds panel to open whenever the user expands the modal.
  // Dismissing during an expanded session is respected (effect only fires
  // on the false → true transition); the panel re-opens next expand.
  useEffect(() => {
    if (expanded) setActiveRailTab('sfx');
  }, [expanded]);

  // Hydrate the current page from a server-saved draft on mount/page-change.
  // Fires when: (a) the recorder is expanded, (b) the page has a saved
  // draft (draft_vocal_url + draft_layers), and (c) we don't already have
  // an in-memory recording. Fetches the blob, parses the layer spec into
  // segments + effects, and marks the page as "synced" so the Save draft
  // button stays disabled until the user makes a real change.
  const [hydratingPage, setHydratingPage] = useState<number | null>(null);
  useEffect(() => {
    if (!expanded) return;
    const pn = pages[currentPageIndex]?.pageNumber;
    if (!pn) return;
    const draft = existingPageDrafts?.[pn];
    if (!draft?.draftVocalUrl || !draft?.draftLayers) return;
    if (pageRecordings.has(currentPageIndex)) return;
    if (hydratingPage === currentPageIndex) return;

    setHydratingPage(currentPageIndex);
    let cancelled = false;
    (async () => {
      try {
        const blobRes = await fetch(draft.draftVocalUrl!);
        if (!blobRes.ok) throw new Error(`Fetch draft: HTTP ${blobRes.status}`);
        const blob = await blobRes.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);

        // Decode duration via Web Audio for accuracy across codecs.
        let duration = draft.draftLayers!.vocal.durationSec ?? 0;
        try {
          const tempCtx = new AudioContext();
          const buf = await blob.arrayBuffer();
          const decoded = await tempCtx.decodeAudioData(buf.slice(0));
          duration = decoded.duration;
          await tempCtx.close().catch(() => undefined);
        } catch { /* fall back to layer spec duration */ }
        if (cancelled) return;

        const layers = draft.draftLayers!;
        const segments = layers.vocal.segments && layers.vocal.segments.length > 0
          ? layers.vocal.segments
          : [{ startSec: 0, endSec: duration }];

        // Hydrate SFX + music — both reference rows in sfx_library by id.
        // Single batched lookup covers both, then we route by kind (the
        // GET response includes kind on each row).
        const libIds = [
          ...layers.effects.map((e) => e.sfxLibraryId),
          ...layers.music.map((m) => m.sfxLibraryId),
        ].filter((v): v is string => !!v);
        const soundsById = new Map<string, SfxLibraryItem>();
        if (libIds.length > 0) {
          try {
            const lookupRes = await fetch(`/api/v1/sfx-library?ids=${encodeURIComponent(libIds.join(','))}`);
            const lookupData = await lookupRes.json().catch(() => ({}));
            for (const s of (lookupData.sounds ?? []) as SfxLibraryItem[]) {
              soundsById.set(s.id, s);
            }
          } catch (err) {
            console.warn('SFX library hydration lookup failed:', err);
          }
        }
        if (cancelled) return;

        const hydratedEffects: PendingEffect[] = layers.effects
          .map((e) => {
            const sound = e.sfxLibraryId ? soundsById.get(e.sfxLibraryId) : undefined;
            if (!sound) return null;
            return {
              id: e.id,
              sound,
              startSec: e.startSec,
              durationSec: e.durationSec,
              sourceOffsetSec: e.sourceOffsetSec ?? 0,
              volumeDb: e.volumeDb ?? -6,
            } as PendingEffect;
          })
          .filter((x): x is PendingEffect => x !== null);

        const hydratedMusic: PendingEffect[] = layers.music
          .map((m) => {
            const sound = m.sfxLibraryId ? soundsById.get(m.sfxLibraryId) : undefined;
            if (!sound) return null;
            return {
              id: m.id,
              sound,
              startSec: m.startSec,
              durationSec: m.durationSec,
              sourceOffsetSec: 0,
              volumeDb: m.volumeDb ?? -12,
            } as PendingEffect;
          })
          .filter((x): x is PendingEffect => x !== null);

        setPageRecordings((prev) => {
          const next = new Map(prev);
          const existing = next.get(currentPageIndex);
          if (existing) URL.revokeObjectURL(existing.url);
          next.set(currentPageIndex, { blob, url, duration });
          return next;
        });
        setPageVocalSegments((prev) => {
          const next = new Map(prev);
          next.set(currentPageIndex, segments);
          return next;
        });
        setPageEffects((prev) => {
          const next = new Map(prev);
          next.set(currentPageIndex, hydratedEffects);
          return next;
        });
        setPageMusic((prev) => {
          const next = new Map(prev);
          next.set(currentPageIndex, hydratedMusic);
          return next;
        });
        if (typeof layers.vocal.volumeDb === 'number') {
          setPageVocalVolumeDb((prev) => {
            const next = new Map(prev);
            next.set(currentPageIndex, layers.vocal.volumeDb!);
            return next;
          });
        }
        // Mark as already-synced so Save draft starts disabled.
        const syntheticLayers: AudioLayers = {
          version: 1,
          vocal: { url, durationSec: duration, segments },
          music: hydratedMusic.map((m) => ({
            id: m.id,
            url: m.sound.audio_url,
            sfxLibraryId: m.sound.id,
            startSec: m.startSec,
            durationSec: m.durationSec,
            volumeDb: m.volumeDb,
          })),
          effects: hydratedEffects.map((eff) => ({
            id: eff.id,
            url: eff.sound.audio_url,
            sfxLibraryId: eff.sound.id,
            startSec: eff.startSec,
            durationSec: eff.durationSec,
            sourceOffsetSec: eff.sourceOffsetSec || undefined,
            volumeDb: eff.volumeDb,
          })),
        };
        lastSavedLayersHashRef.current.set(currentPageIndex, hashLayers(syntheticLayers));
        draftBlobUploadedRef.current.add(currentPageIndex);
        if (draft.draftLayers!.vocal.url) {
          // Track that the server already has THIS blob — re-saves shouldn't
          // re-upload until the user replaces the blob (e.g., destructive delete).
        }
      } catch (err: any) {
        console.error('Hydration failed:', err);
      } finally {
        if (!cancelled) setHydratingPage(null);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, currentPageIndex, existingPageDrafts]);

  // One-shot auto-fit per page: when a recording becomes available, pick
  // a zoom that fits the vocal to ~80% of the available timeline width
  // so there's headroom to scroll/zoom in either direction. Subsequent
  // user zoom adjustments are preserved. Re-recording a page clears its
  // entry below so the next take gets a fresh fit.
  const currentRecordingForFit = pageRecordings.get(currentPageIndex);
  useEffect(() => {
    if (!expanded || !currentRecordingForFit) return;
    if (autoFittedPagesRef.current.has(currentPageIndex)) return;
    if (trackStackWidth <= 0) return;
    const availablePx = trackStackWidth - TRACK_LABEL_WIDTH;
    if (availablePx <= 0) return;
    const dur = Math.max(currentRecordingForFit.duration, 1);
    const targetPxPerSec = (availablePx * 0.8) / dur;
    const desiredZoom = targetPxPerSec / BASE_PX_PER_SEC;
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, desiredZoom));
    setZoomLevel(clamped);
    autoFittedPagesRef.current.add(currentPageIndex);
  }, [expanded, currentPageIndex, currentRecordingForFit, trackStackWidth]);

  // Zoom shortcuts — Cmd/Ctrl + plus/minus/0 globally while the recorder
  // is expanded, plus Cmd/Ctrl + scroll wheel anywhere on the track
  // stack. Wheel needs a native listener with passive: false so we can
  // preventDefault (React's synthetic onWheel is passive in most setups).
  useEffect(() => {
    if (!expanded) return;
    const clamp = (z: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      // Don't hijack typing in the SFX inputs (start/length/vol).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setZoomLevel((z) => clamp(z * 1.25));
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        setZoomLevel((z) => clamp(z / 1.25));
      } else if (e.key === '0') {
        e.preventDefault();
        setZoomLevel(1);
      }
    };
    document.addEventListener('keydown', onKey);
    const el = trackStackRef.current;
    const onWheel = (e: WheelEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      e.preventDefault();
      // deltaY < 0 = scrolling up = zoom in. Step proportional to scroll
      // magnitude so trackpad pinch and mouse-wheel both feel right.
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setZoomLevel((z) => clamp(z * factor));
    };
    el?.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      document.removeEventListener('keydown', onKey);
      el?.removeEventListener('wheel', onWheel);
    };
  }, [expanded]);

  // Global pointer handlers for the voice-boundary drag. Listening on
  // window keeps the drag alive even if the cursor temporarily leaves the
  // handle (e.g., moves over the waveform's WaveSurfer canvas).
  useEffect(() => {
    if (!voiceBoundaryDrag) return;
    const onMove = (e: PointerEvent) => {
      const deltaPx = e.clientX - voiceBoundaryDrag.pointerStartX;
      const deltaSec = deltaPx / voiceBoundaryDrag.frozenPixelsPerSec;
      const newSec = voiceBoundaryDrag.initialOriginalSec + deltaSec;
      updateVoiceBoundary(voiceBoundaryDrag.boundaryIdx, voiceBoundaryDrag.side, newSec);
    };
    const onUp = () => setVoiceBoundaryDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceBoundaryDrag]);

  // Auto-save safety net — every 2 minutes, if the current page has
  // pending changes and we're not in the middle of recording / saving /
  // rendering, quietly fire a Save draft. Belt-and-suspenders for
  // laptop-lid-closes-mid-session and similar.
  useEffect(() => {
    if (!expanded) return;
    const id = setInterval(() => {
      if (savingDraftPage !== null) return;
      if (renderingPage !== null) return;
      if (isRecording) return;
      if (!getAudioPageId(currentPageIndex)) return;
      if (!isPageDirty(currentPageIndex)) return;
      void handleSaveAsDraft(currentPageIndex);
    }, 2 * 60 * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, currentPageIndex, isRecording, savingDraftPage, renderingPage]);

  // Delete shortcut — Delete/Backspace removes whichever voice thing is
  // selected (cut OR segment). Both are destructive (offline render).
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (selectedCutIdx !== null) {
        e.preventDefault();
        void deleteCutAt(selectedCutIdx);
      } else if (selectedVoiceSegmentIdx !== null) {
        e.preventDefault();
        void deleteSegmentAt(selectedVoiceSegmentIdx);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, selectedCutIdx, selectedVoiceSegmentIdx]);

  // Split shortcut — `S` splits whatever is selected at the current
  // playhead. Dispatches: selected SFX → split SFX; selected music →
  // split music; nothing selected → split the voice segment under the
  // playhead.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 's' && e.key !== 'S') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const playheadMix = scrubSec ?? mixCurrentSec;
      if (selectedEffectId) {
        const list = pageEffects.get(currentPageIndex);
        const clip = list?.find((eff) => eff.id === selectedEffectId);
        if (!clip) return;
        if (playheadMix <= clip.startSec + 0.05) return;
        if (playheadMix >= clip.startSec + clip.durationSec - 0.05) return;
        e.preventDefault();
        splitEffectAtMixTime(selectedEffectId, playheadMix);
        return;
      }
      if (selectedMusicId) {
        const list = pageMusic.get(currentPageIndex);
        const clip = list?.find((m) => m.id === selectedMusicId);
        if (!clip) return;
        if (playheadMix <= clip.startSec + 0.05) return;
        if (playheadMix >= clip.startSec + clip.durationSec - 0.05) return;
        e.preventDefault();
        splitMusicAtMixTime(selectedMusicId, playheadMix);
        return;
      }
      // Voice split path.
      if (!currentRecording) return;
      const segs = pageVocalSegments.get(currentPageIndex)
        ?? [{ startSec: 0, endSec: currentRecording.duration }];
      const mapping = mixTimeToOriginal(playheadMix, segs);
      if (!mapping) return;
      const seg = segs[mapping.segIdx];
      if (mapping.origSec <= seg.startSec + 0.05) return;
      if (mapping.origSec >= seg.endSec - 0.05) return;
      e.preventDefault();
      splitVoiceAtMixTime(playheadMix);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, selectedEffectId, selectedMusicId, pageEffects, pageMusic, pageVocalSegments, currentPageIndex, mixCurrentSec, scrubSec, currentRecording]);

  // Dispose any active mix player on unmount or when the current page
  // changes (each page has its own composition).
  useEffect(() => {
    return () => {
      mixPlayerRef.current?.dispose();
      mixPlayerRef.current = null;
    };
  }, [currentPageIndex]);

  // Invalidate the cached mix player when its inputs change — next Play
  // click rebuilds with the new vocal trim or effect set.
  const mixVersion = (() => {
    if (!currentRecording) return 'none';
    const segs = currentSegments.map((s) => `${s.startSec.toFixed(2)}-${s.endSec.toFixed(2)}`).join(',');
    const fx = currentEffects.map((e) => `${e.id}:${e.startSec}:${e.durationSec}:${e.sourceOffsetSec}:${e.volumeDb}`).join('|');
    const mu = currentMusic.map((m) => `${m.id}:${m.startSec}:${m.durationSec}:${m.sourceOffsetSec}:${m.volumeDb}`).join('|');
    return `${currentRecording.url}|${currentVocalVolumeDb}|${segs}|${fx}|${mu}`;
  })();
  useEffect(() => {
    // Any change to the mix recipe invalidates the cached player.
    if (mixPlayerRef.current) {
      mixPlayerRef.current.dispose();
      mixPlayerRef.current = null;
      setMixPlaying(false);
      setMixCurrentSec(0);
      setScrubSec(null);
    }
  }, [mixVersion]);

  const toggleMixPlayback = async () => {
    if (!currentRecording) return;
    // Currently playing → stop. We need to flip mixPlaying ourselves
    // because the player only emits onEnded when the composition finishes
    // naturally — pausing mid-play doesn't fire that callback, so without
    // this line the button stays stuck on "⏸ Stop" and the next click
    // re-enters this branch instead of resuming.
    if (mixPlayerRef.current && mixPlaying) {
      mixPlayerRef.current.stop();
      setMixPlaying(false);
      return;
    }
    // Cached player from a previous play → just resume.
    if (mixPlayerRef.current) {
      mixPlayerRef.current.play();
      setMixPlaying(true);
      return;
    }
    // No player yet → build one. Must run in the user-gesture handler so
    // iOS Safari unlocks the AudioContext.
    setMixLoading(true);
    try {
      const player = await createMixPlayer({
        vocalBlob: currentRecording.blob,
        // segments[] is the source of truth — multi-segment vocals play
        // back-to-back, skipping gaps. trimRange is only sent for the
        // legacy single-segment fallback (kept for back-compat).
        segments: currentSegments.length > 0 ? currentSegments : undefined,
        trimRange: currentTrim,
        vocalVolumeDb: currentVocalVolumeDb,
        effects: currentEffects.map((e) => ({
          id: e.id,
          url: e.sound.audio_url,
          startSec: e.startSec,
          durationSec: e.durationSec,
          sourceOffsetSec: e.sourceOffsetSec,
          volumeDb: e.volumeDb,
        })),
        music: currentMusic.map((m) => ({
          id: m.id,
          url: m.sound.audio_url,
          startSec: m.startSec,
          durationSec: m.durationSec,
          sourceOffsetSec: m.sourceOffsetSec,
          volumeDb: m.volumeDb,
        })),
      });
      player.onProgress((sec, total) => {
        setMixCurrentSec(sec);
        setMixTotalSec(total);
      });
      player.onEnded(() => setMixPlaying(false));
      setMixTotalSec(player.durationSec);
      mixPlayerRef.current = player;
      player.play();
      setMixPlaying(true);
    } catch (err: any) {
      console.error('Mix preview failed:', err);
      alert(`Couldn't preview mix: ${err.message || 'Unknown error'}`);
    } finally {
      setMixLoading(false);
    }
  };

  // Drag handlers
  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return;
      const maxX = window.innerWidth - panelRef.current.offsetWidth;
      const maxY = window.innerHeight - panelRef.current.offsetHeight;
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, maxX));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, maxY));
      setPanelPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    setIsDragging(true);
  };

  const requestMicrophoneAccess = async (): Promise<MediaStream | null> => {
    try {
      if (!window.isSecureContext) {
        alert('Audio recording requires HTTPS or localhost.');
        return null;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        alert('Audio recording is not supported in your browser. Please update Chrome, Firefox, Safari, or Edge.');
        return null;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);
      return stream;
    } catch (err: any) {
      console.error('Microphone access error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Microphone access denied. Please allow microphone access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone found. Please connect a microphone and try again.');
      } else {
        alert(`Failed to access microphone: ${err.message}`);
      }
      return null;
    }
  };

  const startRecording = async () => {
    let stream = audioStream;
    if (!stream) {
      stream = await requestMicrophoneAccess();
      if (!stream) return;
    }
    try {
      // Try codecs in preference order; Safari may need mp4 fallback.
      const codecOptions: MediaRecorderOptions[] = [
        { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/webm', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/mp4', audioBitsPerSecond: 128000 },
        { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 128000 },
        {},
      ];
      let recorder: MediaRecorder | null = null;
      for (const options of codecOptions) {
        try {
          if (options.mimeType && !MediaRecorder.isTypeSupported(options.mimeType)) continue;
          recorder = new MediaRecorder(stream, options);
          break;
        } catch {
          continue;
        }
      }
      if (!recorder) throw new Error('No supported audio codec found');

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        if (chunks.length === 0) {
          alert('Recording failed — no audio captured. Please try again.');
          return;
        }
        const blob = new Blob(chunks, { type: recorder!.mimeType });
        if (blob.size === 0) {
          alert('Recording failed — empty audio. Please try again.');
          return;
        }
        const url = URL.createObjectURL(blob);
        const capturedPageIndex = currentPageIndex;
        // Optimistic duration so the UI doesn't lag — uses the unpaused
        // timer (`recordingTime`) which already excludes paused time.
        // Then we decode the blob to get the EXACT audio length; without
        // this the container width can be wider than the audio when
        // pauses or codec latency shave milliseconds, leaving dead space
        // at the end of the voice track where playback can't reach.
        const initialDuration = Math.max(0.5, Math.min(recordingTime, maxSecondsPerPage));
        const commitRecording = (durationSec: number) => {
          setPageRecordings((prev) => {
            const next = new Map(prev);
            const existing = next.get(capturedPageIndex);
            // Only replace blob URL on the FIRST commit; the refined-duration
            // commit reuses the same blob, so revoking would break playback.
            if (existing && existing.blob !== blob) {
              URL.revokeObjectURL(existing.url);
            }
            next.set(capturedPageIndex, {
              blob,
              url,
              duration: Math.max(0.5, Math.min(durationSec, maxSecondsPerPage)),
            });
            return next;
          });
        };
        commitRecording(initialDuration);
        // New take → re-fit the zoom on next render.
        autoFittedPagesRef.current.delete(capturedPageIndex);
        // Reset trim / saved markers — new take invalidates them.
        setSavedPages((prev) => {
          if (!prev.has(capturedPageIndex)) return prev;
          const next = new Set(prev);
          next.delete(capturedPageIndex);
          return next;
        });
        setPageVocalSegments((prev) => {
          if (!prev.has(capturedPageIndex)) return prev;
          const next = new Map(prev);
          next.delete(capturedPageIndex);
          return next;
        });
        // Refine duration via Web Audio decode. HTMLAudioElement reports
        // Infinity for WebM blobs until a seek past end; decodeAudioData
        // is reliable for all our supported codecs.
        (async () => {
          try {
            const buf = await blob.arrayBuffer();
            const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const decoded = await tempCtx.decodeAudioData(buf);
            const exact = decoded.duration;
            await tempCtx.close().catch(() => undefined);
            if (isFinite(exact) && exact > 0) commitRecording(exact);
          } catch (err) {
            console.warn('Could not decode blob for precise duration; using timer fallback:', err);
          }
        })();
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimeRef.current = Date.now();

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= maxSecondsPerPage) stopRecording();
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Recording start error:', err);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsPaused(false);
  };

  const pauseRecording = () => {
    if (mediaRecorder?.state === 'recording') {
      mediaRecorder.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder?.state === 'paused') {
      mediaRecorder.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          const next = prev + 1;
          if (next >= maxSecondsPerPage) stopRecording();
          return next;
        });
      }, 1000);
    }
  };

  const deleteRecording = () => {
    setPageRecordings((prev) => {
      const next = new Map(prev);
      const rec = next.get(currentPageIndex);
      if (rec) {
        URL.revokeObjectURL(rec.url);
        next.delete(currentPageIndex);
      }
      return next;
    });
    autoFittedPagesRef.current.delete(currentPageIndex);
    setSavedPages((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Set(prev);
      next.delete(currentPageIndex);
      return next;
    });
    setPageVocalSegments((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Map(prev);
      next.delete(currentPageIndex);
      return next;
    });
    setSelectedVoiceSegmentIdx(null);
  };

  /** WaveSurfer's single region maps to the OUTER trim — first segment's
   *  startSec and last segment's endSec. Any middle segments (from splits)
   *  are preserved as long as they still sit inside the new outer range;
   *  middle segments that would fall outside get clamped to the edge. */
  const updateCurrentTrim = (range: TrimRange) => {
    // Preserve the playhead's ORIGINAL-time position across the trim
    // change. Visually keeps the playhead pinned where it was.
    const prevFirstStart = currentSegments[0]?.startSec ?? 0;
    const playheadOriginalSec = prevFirstStart + mixCurrentSec;
    setPageVocalSegments((prev) => {
      const next = new Map(prev);
      const old = prev.get(currentPageIndex);
      const base = old && old.length > 0
        ? old
        : (currentRecording ? [{ startSec: 0, endSec: currentRecording.duration }] : []);
      if (base.length === 0) return prev;
      const updated: VocalSegment[] = base.map((seg, idx) => {
        if (idx === 0 && base.length === 1) {
          return { startSec: range.startSec, endSec: range.endSec };
        }
        if (idx === 0) return { ...seg, startSec: range.startSec };
        if (idx === base.length - 1) return { ...seg, endSec: range.endSec };
        return seg;
      })
      // Drop any middle segment that now sits entirely outside the new
      // outer bounds (or is degenerate after the clamp).
      .filter((s) => s.endSec > s.startSec && s.endSec > range.startSec && s.startSec < range.endSec)
      // And clamp any remaining segment to the new outer bounds.
      .map((s) => ({
        startSec: Math.max(s.startSec, range.startSec),
        endSec: Math.min(s.endSec, range.endSec),
      }))
      .filter((s) => s.endSec - s.startSec > 0.01);
      next.set(currentPageIndex, updated);
      return next;
    });
    // Update playhead mix-time to match the preserved original-time
    // position. Recompute against the FUTURE segments (we know the new
    // outer bounds; middle segments shouldn't change the mapping math
    // significantly for a single-region drag).
    let nextMixSec: number;
    if (playheadOriginalSec <= range.startSec) {
      nextMixSec = 0;
    } else if (playheadOriginalSec >= range.endSec) {
      nextMixSec = Math.max(0, range.endSec - range.startSec);
    } else {
      nextMixSec = playheadOriginalSec - range.startSec;
    }
    setMixCurrentSec(nextMixSec);
  };

  const [loadingSavedAudio, setLoadingSavedAudio] = useState<number | null>(null);

  /** Fetch a server-saved audio URL as a Blob and seed it into the in-memory
      recording map so the user can re-trim and re-save. The fetched file is
      already a final MP3 — re-trim narrows further (lossless `-c copy`), it
      doesn't restore audio the user previously cut. */
  const loadSavedAudioForEdit = async (pageIndex: number) => {
    const entry = existingPageAudio?.[pages[pageIndex]?.pageNumber];
    if (!entry?.audioUrl) return;
    setLoadingSavedAudio(pageIndex);
    try {
      const res = await fetch(entry.audioUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Try to read duration from an offscreen <audio> element. Falls back
      // to 0 if metadata never loads — UI will still let the user trim.
      const duration = await new Promise<number>((resolve) => {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.src = url;
        a.onloadedmetadata = () => resolve(Math.round(a.duration || 0));
        a.onerror = () => resolve(0);
        setTimeout(() => resolve(0), 5000);
      });
      setPageRecordings((prev) => {
        const next = new Map(prev);
        const existing = next.get(pageIndex);
        if (existing) URL.revokeObjectURL(existing.url);
        next.set(pageIndex, { blob, url, duration });
        return next;
      });
      autoFittedPagesRef.current.delete(pageIndex);
      // Editing a saved take = unsaved changes until next Save.
      setSavedPages((prev) => {
        if (!prev.has(pageIndex)) return prev;
        const next = new Set(prev);
        next.delete(pageIndex);
        return next;
      });
      setPageVocalSegments((prev) => {
        if (!prev.has(pageIndex)) return prev;
        const next = new Map(prev);
        next.delete(pageIndex);
        return next;
      });
    } catch (err: any) {
      console.error('Failed to load saved audio for edit:', err);
      alert(`Could not load the saved audio for editing: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingSavedAudio(null);
    }
  };

  const hasSavedAudioOnServer = (pageIndex: number): boolean => {
    const pn = pages[pageIndex]?.pageNumber;
    return !!(pn && existingPageAudio?.[pn]?.audioUrl);
  };

  const resetCurrentTrim = () => {
    setPageVocalSegments((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Map(prev);
      next.delete(currentPageIndex);
      return next;
    });
    setSelectedVoiceSegmentIdx(null);
  };

  const addEffect = (sound: SfxLibraryItem) => {
    setPageEffects((prev) => {
      const next = new Map(prev);
      const list = next.get(currentPageIndex) ?? [];
      const newId = `eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next.set(currentPageIndex, [
        ...list,
        {
          id: newId,
          sound,
          startSec: 0,
          durationSec: sound.duration_sec,
          sourceOffsetSec: 0,
          volumeDb: -6,
        },
      ]);
      // Auto-select the newly-added clip so the volume strip below the
      // timeline immediately reflects its settings.
      setSelectedEffectId(newId);
      return next;
    });
  };

  const updateEffect = (
    effectId: string,
    patch: Partial<Pick<PendingEffect, 'startSec' | 'volumeDb' | 'durationSec' | 'sourceOffsetSec'>>,
  ) => {
    setPageEffects((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const next = new Map(prev);
      next.set(currentPageIndex, list.map((e) => e.id === effectId ? { ...e, ...patch } : e));
      return next;
    });
  };

  const removeEffect = (effectId: string) => {
    setPageEffects((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const next = new Map(prev);
      next.set(currentPageIndex, list.filter((e) => e.id !== effectId));
      return next;
    });
  };

  // Music handlers — same shape as effects, separate state map. Default
  // volume −18 dB matches DEFAULT_VOLUMES.music: keeps narration audible.
  const addMusic = (sound: SfxLibraryItem) => {
    setPageMusic((prev) => {
      const next = new Map(prev);
      const list = next.get(currentPageIndex) ?? [];
      const newId = `mus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      next.set(currentPageIndex, [
        ...list,
        {
          id: newId,
          sound,
          startSec: 0,
          durationSec: sound.duration_sec,
          sourceOffsetSec: 0,
          volumeDb: -12,
        },
      ]);
      setSelectedMusicId(newId);
      setSelectedEffectId(null);
      setSelectedCutIdx(null);
      setSelectedVoiceSegmentIdx(null);
      return next;
    });
  };

  const updateMusic = (
    musicId: string,
    patch: Partial<Pick<PendingEffect, 'startSec' | 'volumeDb' | 'durationSec' | 'sourceOffsetSec'>>,
  ) => {
    setPageMusic((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const next = new Map(prev);
      next.set(currentPageIndex, list.map((m) => m.id === musicId ? { ...m, ...patch } : m));
      return next;
    });
  };

  const removeMusic = (musicId: string) => {
    setPageMusic((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const next = new Map(prev);
      next.set(currentPageIndex, list.filter((m) => m.id !== musicId));
      return next;
    });
  };

  /** Split a music clip at a mix-time position. Mirrors splitEffectAtMixTime
   *  exactly — music and SFX clips share the same data shape, so the math
   *  is identical. */
  const splitMusicAtMixTime = (musicId: string, splitMixSec: number): boolean => {
    let didSplit = false;
    setPageMusic((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const idx = list.findIndex((m) => m.id === musicId);
      if (idx < 0) return prev;
      const clip = list[idx];
      const localSec = splitMixSec - clip.startSec;
      if (localSec <= 0.05 || localSec >= clip.durationSec - 0.05) return prev;
      const remainingSourceLen = clip.sound.duration_sec - (clip.sourceOffsetSec + localSec);
      if (remainingSourceLen <= 0.05) return prev;
      const left: PendingEffect = { ...clip, durationSec: localSec };
      const right: PendingEffect = {
        ...clip,
        id: `mus-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startSec: clip.startSec + localSec,
        sourceOffsetSec: clip.sourceOffsetSec + localSec,
        durationSec: clip.durationSec - localSec,
      };
      const nextList = [...list];
      nextList.splice(idx, 1, left, right);
      const next = new Map(prev);
      next.set(currentPageIndex, nextList);
      didSplit = true;
      return next;
    });
    return didSplit;
  };

  /** Split an effect at a mix-time position. Returns true on success.
   *  Cleanest mental model: the left half keeps the original id (so the
   *  user's selection / volume / position references stay valid), the
   *  right half is a brand-new clip with adjusted source offset. Both
   *  point at the same library sound. */
  const splitEffectAtMixTime = (effectId: string, splitMixSec: number): boolean => {
    let didSplit = false;
    setPageEffects((prev) => {
      const list = prev.get(currentPageIndex);
      if (!list) return prev;
      const idx = list.findIndex((e) => e.id === effectId);
      if (idx < 0) return prev;
      const clip = list[idx];
      const localSec = splitMixSec - clip.startSec;
      // Split point must sit strictly inside the clip (not at either edge,
      // and not extending past the source's available length).
      if (localSec <= 0.05 || localSec >= clip.durationSec - 0.05) return prev;
      const remainingSourceLen = clip.sound.duration_sec - (clip.sourceOffsetSec + localSec);
      if (remainingSourceLen <= 0.05) return prev;
      const left: PendingEffect = {
        ...clip,
        durationSec: localSec,
      };
      const right: PendingEffect = {
        ...clip,
        id: `eff-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startSec: clip.startSec + localSec,
        sourceOffsetSec: clip.sourceOffsetSec + localSec,
        durationSec: clip.durationSec - localSec,
      };
      const nextList = [...list];
      nextList.splice(idx, 1, left, right);
      const next = new Map(prev);
      next.set(currentPageIndex, nextList);
      didSplit = true;
      return next;
    });
    return didSplit;
  };

  /** Adjust one side of an inner boundary between voice segments. Used
   *  by the cut-band drag handles to widen or close a gap. Preserves the
   *  playhead's original-time position by recomputing mixCurrentSec when
   *  the segments around it change. Clamps so segments never overlap and
   *  never shrink below a minimum playable length. */
  const updateVoiceBoundary = (boundaryIdx: number, side: 'left' | 'right', newOriginalSec: number) => {
    setPageVocalSegments((prev) => {
      const cur = prev.get(currentPageIndex);
      const base = cur && cur.length > 0
        ? cur
        : (currentRecording ? [{ startSec: 0, endSec: currentRecording.duration }] : []);
      if (boundaryIdx < 0 || boundaryIdx >= base.length - 1) return prev;
      const segLeft = base[boundaryIdx];
      const segRight = base[boundaryIdx + 1];
      const MIN_SEG = 0.05;
      let updated: VocalSegment[];
      if (side === 'left') {
        const clamped = Math.max(segLeft.startSec + MIN_SEG, Math.min(segRight.startSec, newOriginalSec));
        updated = base.map((s, i) => i === boundaryIdx ? { ...s, endSec: clamped } : s);
      } else {
        const clamped = Math.max(segLeft.endSec, Math.min(segRight.endSec - MIN_SEG, newOriginalSec));
        updated = base.map((s, i) => i === boundaryIdx + 1 ? { ...s, startSec: clamped } : s);
      }
      const next = new Map(prev);
      next.set(currentPageIndex, updated);
      return next;
    });
  };

  /** Look up the server-side row id for a page (PR 2). NULL when the page
   *  hasn't been registered server-side yet — Save draft is disabled in
   *  that case until the host provides an audioPageId. */
  const getAudioPageId = (pageIndex: number): string | undefined => {
    const pn = pages[pageIndex]?.pageNumber;
    return pn ? existingPageDrafts?.[pn]?.audioPageId : undefined;
  };

  /** Build the AudioLayers JSON for a page from current in-memory state.
   *  Vocal points at the in-memory blob's URL (which the server replaces
   *  with the uploaded draft URL inside /save-draft when the blob is
   *  included). Used by both Save draft and Finish & Continue. */
  const buildLayersForPage = (pageIndex: number, vocalUrlOverride?: string): AudioLayers | null => {
    const rec = pageRecordings.get(pageIndex);
    if (!rec) return null;
    const segs = pageVocalSegments.get(pageIndex)
      ?? [{ startSec: 0, endSec: rec.duration }];
    const effects = pageEffects.get(pageIndex) ?? [];
    const music = pageMusic.get(pageIndex) ?? [];
    const vocalVol = pageVocalVolumeDb.get(pageIndex) ?? 0;
    return {
      version: 1,
      vocal: {
        url: vocalUrlOverride ?? rec.url,
        durationSec: rec.duration,
        segments: segs,
        ...(vocalVol !== 0 ? { volumeDb: vocalVol } : {}),
      },
      music: music.map((m) => ({
        id: m.id,
        url: m.sound.audio_url,
        sfxLibraryId: m.sound.id,
        startSec: m.startSec,
        durationSec: m.durationSec,
        volumeDb: m.volumeDb,
      })),
      effects: effects.map((e) => ({
        id: e.id,
        url: e.sound.audio_url,
        sfxLibraryId: e.sound.id,
        startSec: e.startSec,
        durationSec: e.durationSec,
        sourceOffsetSec: e.sourceOffsetSec || undefined,
        volumeDb: e.volumeDb,
      })),
    };
  };

  /** Stable hash of a layer spec used for dirty detection. Sorts keys so
   *  trivial reorderings don't cause false-positives. Vocal URL is
   *  intentionally EXCLUDED because the blob's object URL changes on
   *  re-record and we track blob-dirty separately. */
  const hashLayers = (layers: AudioLayers): string => {
    const stripped = {
      vocal: {
        durationSec: layers.vocal.durationSec,
        segments: layers.vocal.segments,
        volumeDb: layers.vocal.volumeDb,
      },
      effects: layers.effects.map((e) => ({
        sfxLibraryId: e.sfxLibraryId,
        startSec: e.startSec,
        durationSec: e.durationSec,
        sourceOffsetSec: e.sourceOffsetSec,
        volumeDb: e.volumeDb,
      })),
      music: layers.music.map((m) => ({
        sfxLibraryId: m.sfxLibraryId,
        startSec: m.startSec,
        durationSec: m.durationSec,
        volumeDb: m.volumeDb,
      })),
    };
    return JSON.stringify(stripped);
  };

  /** Dirty = current layer-hash differs from last server-saved, OR the
   *  blob hasn't been uploaded yet (e.g., right after recording). */
  const isPageDirty = (pageIndex: number): boolean => {
    const layers = buildLayersForPage(pageIndex);
    if (!layers) return false;
    const currentHash = hashLayers(layers);
    const lastHash = lastSavedLayersHashRef.current.get(pageIndex);
    const blobUploaded = draftBlobUploadedRef.current.has(pageIndex);
    return !blobUploaded || currentHash !== lastHash;
  };

  /** PR 2 — persist the current page's edits to the server as a draft.
   *  Uploads the vocal blob only when it's not already on the server.
   *  Always sends layers. */
  const handleSaveAsDraft = async (pageIndex: number): Promise<boolean> => {
    if (savingDraftPage !== null) return false;
    const audioPageId = getAudioPageId(pageIndex);
    if (!audioPageId) {
      console.warn('Save draft skipped: no audioPageId for page', pageIndex);
      return false;
    }
    const rec = pageRecordings.get(pageIndex);
    if (!rec) return false;
    const layers = buildLayersForPage(pageIndex);
    if (!layers) return false;

    setSavingDraftPage(pageIndex);
    try {
      const needsBlob = !draftBlobUploadedRef.current.has(pageIndex);
      const result = await apiSaveDraft({
        audioPageId,
        vocalBlob: needsBlob ? rec.blob : undefined,
        layers,
      });
      if (needsBlob) draftBlobUploadedRef.current.add(pageIndex);
      lastSavedLayersHashRef.current.set(pageIndex, hashLayers(layers));
      setDraftSavedAt((prev) => new Map(prev).set(pageIndex, Date.now()));
      return true;
    } catch (err: any) {
      console.error('Save draft failed:', err);
      alert(`Could not save draft: ${err.message || 'Unknown error'}`);
      return false;
    } finally {
      setSavingDraftPage(null);
    }
  };

  /** Server-side destructive helper used by both deleteSegmentAt and
   *  deleteCutAt. Ensures the draft is uploaded first, then calls
   *  /shrink-source with the survivors, then swaps the in-memory blob
   *  with the new shorter one returned by the server. */
  const commitShrinkSource = async (keepSegments: VocalSegment[]): Promise<boolean> => {
    if (!currentRecording) return false;
    const audioPageId = getAudioPageId(currentPageIndex);
    if (!audioPageId) {
      alert('Cannot delete: this page is not registered server-side yet. Try Save draft first.');
      return false;
    }
    // Make sure the server has the current blob to shrink. If not, save
    // a draft first so /shrink-source has something to operate on.
    if (!draftBlobUploadedRef.current.has(currentPageIndex)) {
      const saved = await handleSaveAsDraft(currentPageIndex);
      if (!saved) return false;
    }
    const pageIdx = currentPageIndex;
    const result = await apiShrinkSource(audioPageId, keepSegments);
    // Fetch the new blob and update in-memory state.
    const blobRes = await fetch(result.draftVocalUrl);
    if (!blobRes.ok) throw new Error(`Fetch shrunk blob: HTTP ${blobRes.status}`);
    const blob = await blobRes.blob();
    const url = URL.createObjectURL(blob);
    setPageRecordings((prev) => {
      const next = new Map(prev);
      const existing = next.get(pageIdx);
      if (existing) URL.revokeObjectURL(existing.url);
      next.set(pageIdx, { blob, url, duration: result.durationSec });
      return next;
    });
    setPageVocalSegments((prev) => {
      const next = new Map(prev);
      next.set(pageIdx, result.segments);
      return next;
    });
    autoFittedPagesRef.current.delete(pageIdx);
    // Server has the new blob — keep the "blob uploaded" flag true.
    draftBlobUploadedRef.current.add(pageIdx);
    // Layer state is now in sync with what the server has after the
    // shrink-source call updated draft_layers. Refresh the dirty-hash so
    // Save draft stays disabled until the user makes a NEW change.
    const syntheticLayers = buildLayersForPage(pageIdx, url);
    if (syntheticLayers) {
      lastSavedLayersHashRef.current.set(pageIdx, hashLayers(syntheticLayers));
      setDraftSavedAt((prev) => new Map(prev).set(pageIdx, Date.now()));
    }
    setSavedPages((prev) => {
      if (!prev.has(pageIdx)) return prev;
      const next = new Set(prev);
      next.delete(pageIdx);
      return next;
    });
    return true;
  };

  /** Destructively remove a whole voice SEGMENT. Goes through the server
   *  so draft_vocal_url stays consistent across sessions — see
   *  commitShrinkSource. */
  const deleteSegmentAt = async (segIdx: number) => {
    if (deletingCut) return;
    if (!currentRecording) return;
    const segs = currentSegments;
    if (segIdx < 0 || segIdx >= segs.length) return;
    const remaining = segs.filter((_, i) => i !== segIdx);
    if (remaining.length === 0) {
      deleteRecording();
      setSelectedVoiceSegmentIdx(null);
      return;
    }
    setDeletingCut(true);
    try {
      const ok = await commitShrinkSource(remaining);
      if (ok) setSelectedVoiceSegmentIdx(null);
    } catch (err: any) {
      console.error('Delete segment failed:', err);
      alert(`Could not delete this segment: ${err.message || 'render failed'}`);
    } finally {
      setDeletingCut(false);
    }
  };

  /** Destructively remove a CUT (gap between two segments). Goes through
   *  the server so the persisted draft stays consistent — see
   *  commitShrinkSource. */
  const deleteCutAt = async (cutIdx: number) => {
    if (deletingCut) return;
    if (!currentRecording) return;
    const segs = currentSegments;
    if (cutIdx < 0 || cutIdx >= segs.length - 1) return;
    const left = segs[cutIdx];
    const right = segs[cutIdx + 1];
    const gapDur = right.startSec - left.endSec;
    if (gapDur <= 0.01) return;
    setDeletingCut(true);
    try {
      // Keep all segments — the server-side concat removes the gap audio
      // between them because keepSegments lists only the active windows.
      const ok = await commitShrinkSource(segs);
      if (ok) setSelectedCutIdx(null);
    } catch (err: any) {
      console.error('Delete cut failed:', err);
      alert(`Could not delete this cut: ${err.message || 'render failed'}`);
    } finally {
      setDeletingCut(false);
    }
  };

  /** Split the voice at a mix-time playhead position. Inserts a new
   *  segment break exactly at the playhead — both halves stay adjacent
   *  initially (no gap). User can then drag the inner edges apart with
   *  the cut-band handles to create a "skip this part" cut. Returns
   *  true on success. */
  const splitVoiceAtMixTime = (splitMixSec: number): boolean => {
    const newSegments = splitSegmentsAtMixTime(splitMixSec, currentSegments);
    if (!newSegments) return false;
    setPageVocalSegments((prev) => {
      const next = new Map(prev);
      next.set(currentPageIndex, newSegments);
      return next;
    });
    return true;
  };

  const playPreview = () => {
    if (!currentRecording || !audioPreviewRef.current) return;
    try {
      audioPreviewRef.current.src = currentRecording.url;
      audioPreviewRef.current.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Playback failed:', err);
          alert(`Failed to play recording: ${err.message}`);
        });
    } catch (err: any) {
      console.error('Playback setup error:', err);
      alert(`Error playing recording: ${err.message}`);
    }
  };

  const stopPreview = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
      audioPreviewRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  /** PATCH /api/v1/audio-pages/{id}/layers with the current page's audio
      composition. The mix service re-renders the MP3 server-side using
      whatever combination of vocal segments + effects is present.
      Segments are sent in upload-trimmed-audio time (already rebased by
      the caller), so the server treats them as offsets into vocalUrl. */
  const applyAudioLayers = async (
    audioPageId: string,
    vocalUrl: string,
    trimmedDurationSec: number,
    segments: VocalSegment[],
    effects: PendingEffect[],
    music: PendingEffect[] = [],
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch(`/api/v1/audio-pages/${audioPageId}/layers`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 1,
          vocal: {
            url: vocalUrl,
            durationSec: trimmedDurationSec,
            // Only send segments when there's actually more than one —
            // single-segment (full upload-trimmed file) is the default
            // and shouldn't trigger the multi-segment filter graph.
            ...(segments.length > 1 ? { segments } : {}),
          },
          music: music.map((m) => ({
            id: m.id,
            url: m.sound.audio_url,
            sfxLibraryId: m.sound.id,
            startSec: m.startSec,
            durationSec: m.durationSec,
            volumeDb: m.volumeDb,
          })),
          effects: effects.map((e) => ({
            id: e.id,
            url: e.sound.audio_url,
            sfxLibraryId: e.sound.id,
            startSec: e.startSec,
            durationSec: e.durationSec,
            sourceOffsetSec: e.sourceOffsetSec || undefined,
            volumeDb: e.volumeDb,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `HTTP ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  // Save buttons call this instead of handleSaveCurrentPage directly so the
  // merge warning gets a chance to fire when SFX are present.
  const requestSaveCurrentPage = () => {
    if (!currentRecording) {
      alert('No recording for this page. Please record first.');
      return;
    }
    if (currentEffects.length > 0) {
      setMergeConfirmOpen(true);
      return;
    }
    void handleSaveCurrentPage();
  };

  const handleSaveCurrentPage = async () => {
    if (!currentRecording) {
      alert('No recording for this page. Please record first.');
      return;
    }
    setUploading(true);
    try {
      const audioPageId = getAudioPageId(currentPageIndex);

      // PR 2 — chapter book pages have an audioPageId from the server.
      // The flow is: Save draft (persists in-progress state) → /render
      // (mixes and writes audio_url, clears the draft). After render the
      // in-memory state for THIS page is cleared so future visits start
      // fresh from the new committed audio_url.
      if (audioPageId) {
        const savedOk = await handleSaveAsDraft(currentPageIndex);
        if (!savedOk) return;
        setRenderingPage(currentPageIndex);
        try {
          await apiRenderFinal(audioPageId);
        } catch (err: any) {
          alert(`Render failed: ${err.message || 'Unknown error'}\n\nYour draft is saved — you can try again.`);
          return;
        } finally {
          setRenderingPage(null);
        }
        setSavedPages((prev) => new Set(prev).add(currentPageIndex));
        // Drop the in-memory state for this page — it's now committed.
        // Future Edit-existing or hydration will pull the new audio_url.
        const pageIdx = currentPageIndex;
        setPageRecordings((prev) => {
          const next = new Map(prev);
          const existing = next.get(pageIdx);
          if (existing) URL.revokeObjectURL(existing.url);
          next.delete(pageIdx);
          return next;
        });
        setPageVocalSegments((prev) => {
          const next = new Map(prev);
          next.delete(pageIdx);
          return next;
        });
        setPageEffects((prev) => {
          const next = new Map(prev);
          next.delete(pageIdx);
          return next;
        });
        setPageMusic((prev) => {
          const next = new Map(prev);
          next.delete(pageIdx);
          return next;
        });
        setPageVocalVolumeDb((prev) => {
          const next = new Map(prev);
          next.delete(pageIdx);
          return next;
        });
        lastSavedLayersHashRef.current.delete(pageIdx);
        draftBlobUploadedRef.current.delete(pageIdx);
        autoFittedPagesRef.current.delete(pageIdx);
        setDraftSavedAt((prev) => {
          if (!prev.has(pageIdx)) return prev;
          const next = new Map(prev);
          next.delete(pageIdx);
          return next;
        });
        setSelectedEffectId(null);
        setSelectedCutIdx(null);
        setSelectedVoiceSegmentIdx(null);
      } else {
        // Picture book (or chapter book row not yet registered server-
        // side) — fall back to the legacy onSaveRecording host callback.
        // This calls the chapter-book upload-user-audio endpoint which
        // trims via FFmpeg + uploads the result to audio_url.
        const result = await onSaveRecording({
          page: currentPage,
          pageIndex: currentPageIndex,
          blob: currentRecording.blob,
          duration: currentRecording.duration,
          language: recordingLanguage,
          trim: currentTrim,
        });
        if (!result.success) {
          alert(`Failed to save page ${currentPageIndex + 1}: ${result.error || 'Unknown error'}\n\nPlease try again.`);
          return;
        }
        // Legacy: if SFX OR music OR cuts present, PATCH /layers via
        // applyAudioLayers to trigger a mix render. Mirrors pre-PR-2
        // behavior exactly with music added to the trigger condition.
        const needsMixRender = currentEffects.length > 0
          || currentMusic.length > 0
          || currentSegments.length > 1;
        if (needsMixRender && result.audioPageId && result.audioUrl) {
          const trimStart = currentTrim?.startSec ?? 0;
          const trimmedDuration = currentTrim
            ? currentTrim.endSec - currentTrim.startSec
            : currentRecording.duration;
          const rebasedSegments: VocalSegment[] = currentSegments.length > 1
            ? currentSegments.map((s) => ({
                startSec: Math.max(0, s.startSec - trimStart),
                endSec: Math.max(0, s.endSec - trimStart),
              }))
            : [];
          const mixResult = await applyAudioLayers(
            result.audioPageId,
            result.audioUrl,
            trimmedDuration,
            rebasedSegments,
            currentEffects,
            currentMusic,
          );
          if (!mixResult.success) {
            alert(`Vocal saved, but mixing failed: ${mixResult.error}\n\nThe page has audio without cuts/effects. Try editing the page again to retry.`);
          }
        }
        setSavedPages((prev) => new Set(prev).add(currentPageIndex));
      }

      if (currentPageIndex < totalPages - 1) {
        setCurrentPageIndex((i) => i + 1);
        if (isPlaying) stopPreview();
      } else {
        onAllSaved?.();
        handleClose();
      }
    } catch (err: any) {
      console.error('Finish & Continue error:', err);
      alert(`Error saving audio: ${err.message || 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setUploading(false);
    }
  };

  /** Wrap a navigation action with the unsaved-changes guard. If the
   *  current page has pending draft edits, opens the navConfirm modal
   *  and stages the action; otherwise runs it immediately. */
  const guardedNavigate = (action: () => void) => {
    if (!isPageDirty(currentPageIndex) || !getAudioPageId(currentPageIndex)) {
      action();
      return;
    }
    setNavConfirm({ proceed: action });
  };

  /** Discard in-memory edits for the current page. Next time the page is
   *  visited, the hydration effect will reload from the server-saved
   *  draft (or fall back to a fresh empty state). */
  const discardCurrentPageEdits = () => {
    const idx = currentPageIndex;
    setPageRecordings((prev) => {
      const next = new Map(prev);
      const existing = next.get(idx);
      if (existing) URL.revokeObjectURL(existing.url);
      next.delete(idx);
      return next;
    });
    setPageVocalSegments((prev) => {
      const next = new Map(prev);
      next.delete(idx);
      return next;
    });
    setPageEffects((prev) => {
      const next = new Map(prev);
      next.delete(idx);
      return next;
    });
    setPageMusic((prev) => {
      const next = new Map(prev);
      next.delete(idx);
      return next;
    });
    setPageVocalVolumeDb((prev) => {
      const next = new Map(prev);
      next.delete(idx);
      return next;
    });
    lastSavedLayersHashRef.current.delete(idx);
    draftBlobUploadedRef.current.delete(idx);
    autoFittedPagesRef.current.delete(idx);
    setSelectedEffectId(null);
    setSelectedCutIdx(null);
    setSelectedVoiceSegmentIdx(null);
    setSelectedMusicId(null);
  };

  const handleSkipPage = () => {
    guardedNavigate(() => {
      if (isPlaying) stopPreview();
      if (isLastPage) {
        handleClose();
        return;
      }
      setCurrentPageIndex((i) => i + 1);
    });
  };

  const handlePreviousPage = () => {
    guardedNavigate(() => {
      if (isPlaying) stopPreview();
      if (currentPageIndex <= 0) return;
      setCurrentPageIndex((i) => i - 1);
    });
  };

  const handleClose = () => {
    if (isRecording && mediaRecorder) mediaRecorder.stop();
    if (audioPreviewRef.current) audioPreviewRef.current.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setIsPlaying(false);
    onClose();
  };

  if (!currentPage) return null;

  const audioElement = (
    <audio
      ref={audioPreviewRef}
      onEnded={() => setIsPlaying(false)}
      onPause={() => setIsPlaying(false)}
    />
  );

  const languageToggle = secondaryLanguage && (
    <div className="flex rounded-md overflow-hidden border border-gray-300">
      <button
        onClick={() => setRecordingLanguage('en')}
        className={`px-2 py-0.5 text-xs font-medium transition-colors ${
          recordingLanguage === 'en'
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setRecordingLanguage(secondaryLanguage.code)}
        className={`px-2 py-0.5 text-xs font-medium transition-colors ${
          recordingLanguage === secondaryLanguage.code
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-100'
        }`}
      >
        {secondaryLanguage.label}
      </button>
    </div>
  );

  const statusLine = (
    <p className="text-xs text-gray-600">
      <span className="text-green-600 font-semibold">{savedPages.size}</span>
      <span className="text-gray-500"> saved, </span>
      <span className="text-gray-500">{totalPages - savedPages.size} left</span>
    </p>
  );

  const navAndSaveButtons = (size: 'sm' | 'md' = 'sm', showDelete = false) => (
    <div className={`flex gap-2 ${size === 'md' ? 'mt-4' : 'mb-3'}`}>
      <button
        onClick={handlePreviousPage}
        disabled={uploading || currentPageIndex === 0}
        title="Previous page"
        aria-label="Previous page"
        className={`rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
          size === 'md' ? 'px-4 py-2.5' : 'px-3 py-2'
        }`}
      >
        <SkipBack className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>
      {showDelete && currentRecording && (
        <button
          onClick={deleteRecording}
          disabled={uploading}
          title="Delete this recording (does not affect saved server copy until next Save)"
          aria-label="Delete recording"
          className={`rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
            size === 'md' ? 'px-4 py-2.5' : 'px-3 py-2'
          }`}
        >
          <svg className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
          </svg>
        </button>
      )}
      <button
        onClick={requestSaveCurrentPage}
        disabled={uploading || !currentRecording}
        className={`flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          size === 'md' ? 'px-5 py-2.5 text-base' : 'px-4 py-2 text-sm'
        }`}
      >
        {uploading ? (
          <span className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            Saving...
          </span>
        ) : isLastPage ? (
          'Save & Finish'
        ) : (
          'Save & Continue'
        )}
      </button>
      <button
        onClick={handleSkipPage}
        disabled={uploading}
        title={isLastPage ? 'Skip and finish (this page keeps AI narration)' : 'Skip page (this page keeps AI narration)'}
        aria-label="Skip page"
        className={`rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
          size === 'md' ? 'px-4 py-2.5' : 'px-3 py-2'
        }`}
      >
        <SkipForward className={size === 'md' ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>
    </div>
  );

  // Recording in-progress block — same layout in both views.
  const renderRecordingInProgress = (large = false) => (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 mb-3">
        <div className="flex gap-1">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-6 bg-red-500 rounded-full animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
        <span className={`font-bold text-gray-900 ${large ? 'text-3xl' : 'text-xl'}`}>
          {formatTime(recordingTime)}
        </span>
        <span className="text-xs text-gray-600">/ {maxSecondsPerPage}s</span>
      </div>
      <div className="w-full mb-4">
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-red-500 to-pink-500 transition-all"
            style={{ width: `${(recordingTime / maxSecondsPerPage) * 100}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {!isPaused ? (
          <button
            onClick={pauseRecording}
            className="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600 font-semibold shadow-lg transition-all text-sm"
          >
            ⏸️ Pause
          </button>
        ) : (
          <button
            onClick={resumeRecording}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 font-semibold shadow-lg transition-all text-sm"
          >
            ▶️ Resume
          </button>
        )}
        <button
          onClick={stopRecording}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-all text-sm"
        >
          ⏹️ Stop
        </button>
      </div>
    </div>
  );

  // Start-recording CTA — fixed-width, solid colors (no gradients on
  // secondary actions), no surrounding card. When the page already has a
  // saved take, "Edit saved audio" and "Record new" sit side-by-side; both
  // are explicit-width buttons so they don't stretch to fill the row.
  const renderStartRecording = (large = false) => {
    const hasSaved = hasSavedAudioOnServer(currentPageIndex);
    const isLoading = loadingSavedAudio === currentPageIndex;
    const sizing = large ? 'px-5 py-2.5 text-sm w-44' : 'px-4 py-2 text-sm w-36';
    return (
      <div className="text-center">
        {hasSaved ? (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => loadSavedAudioForEdit(currentPageIndex)}
              disabled={isLoading}
              className={`${sizing} bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoading ? 'Loading…' : 'Edit existing'}
            </button>
            <button
              onClick={startRecording}
              className={`${sizing} bg-red-500 text-white rounded-md hover:bg-red-600 font-medium transition-colors`}
            >
              Record new
            </button>
          </div>
        ) : (
          <button
            onClick={startRecording}
            className={`${sizing} bg-red-500 text-white rounded-md hover:bg-red-600 font-medium transition-colors inline-flex items-center justify-center gap-2`}
          >
            <span className="w-2 h-2 bg-white rounded-full"></span>
            Start recording
          </button>
        )}
        <p className="text-xs text-gray-500 mt-3">
          Max {maxSecondsPerPage}s per page
        </p>
      </div>
    );
  };

  return (
    <>
      {audioElement}
      {expanded ? (
        // Expanded view: centered modal. The card is a flex row — left rail
        // (icon strip + optional panel) on the left, scrollable main content
        // area on the right. Adding more rails / right-side inspector in
        // future PRs just plugs into this same outer flex.
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-[1600px] h-[95vh] flex overflow-hidden">
            <LeftRail
              tabs={[
                {
                  id: 'sfx',
                  icon: <Music className="w-5 h-5" />,
                  label: 'Sounds',
                  hideHeader: true,
                  content: (
                    <SFXBrowserPanel
                      onPick={(sound, kind) => {
                        if (kind === 'music') addMusic(sound);
                        else addEffect(sound);
                      }}
                      onClose={() => setActiveRailTab(null)}
                    />
                  ),
                },
              ]}
              activeTabId={activeRailTab}
              onTabChange={setActiveRailTab}
            />
            {/* Vertical flex column: header on top, text/image area expands
                to fill the upper portion, timeline + controls dock at the
                bottom. Future scene image will slot into the .flex-1
                content area without touching the lower stack. */}
            <div className="flex-1 min-w-0 flex flex-col p-6 min-h-0">
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900 tracking-tight">Recording mode</h3>
              <div className="flex items-center gap-3">
                {languageToggle}
                <button
                  onClick={() => setExpanded(false)}
                  aria-label="Minimize"
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <Minimize2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => guardedNavigate(() => handleClose())}
                  aria-label="Close recording mode"
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Page text — what the user is reading. Takes the upper area
                of the modal (flex-1) so chapter book pages have room to
                breathe; scrolls internally if the text exceeds the space.
                Will share this region with a scene image when that lands. */}
            <div className="mb-4 flex-1 min-h-0 overflow-y-auto">
              {currentPage.text ? (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {currentPage.text}
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">(no narration text for this page)</p>
              )}
            </div>

            {/* Lower stack: tracks + action bar + save bar all dock to the
                bottom of the content column. flex-shrink-0 keeps them at
                their natural height as the text region above grows. */}
            <div className="flex-shrink-0">
            {/* Multi-track editor — voice + sound effects stacked, sharing
                one time axis. pixelsPerSec is FIXED relative to zoom (not
                derived from container width) so opening side panels,
                resizing the modal, or adding long SFX never reshuffles the
                clips. The trackStackRef is the horizontal-scroll viewport;
                content wider than the viewport scrolls. */}
            {currentRecording ? (() => {
              const recordingDur = currentRecording.duration;
              const trimStart = currentTrim?.startSec ?? 0;
              // longestClipEnd is in TIMELINE (original) time so the lane
              // width covers clips that visually extend past the vocal —
              // each clip's right edge sits at trimStart + startSec + duration.
              // Includes BOTH SFX and music so the timeline visible area
              // stays in sync when either kind extends past the vocal.
              const longestClipEnd = [...currentEffects, ...currentMusic].reduce(
                (max, c) => Math.max(max, trimStart + c.startSec + c.durationSec),
                0,
              );
              const timelineSpan = Math.max(recordingDur, longestClipEnd, 5);
              const pixelsPerSec = BASE_PX_PER_SEC * zoomLevel;
              // Total mix duration from current state — max of vocal
              // segments and the latest-ending clip. Used to clamp the
              // playhead so shortening a clip can't leave a stale
              // playhead position floating past the visible content.
              const currentMixDur = Math.max(
                totalMixDuration(currentSegments),
                ...currentEffects.map((e) => e.startSec + e.durationSec),
                ...currentMusic.map((m) => m.startSec + m.durationSec),
                0,
              );
              // mixCurrentSec / scrubSec are in MIX time. The visual
              // timeline is in ORIGINAL time. With multi-segment vocals
              // the mapping has discontinuities at cut boundaries — use
              // mixTimeToOriginal so the playhead jumps over gaps as it
              // crosses them, matching what playback actually does.
              // Falls back to a linear (trimStart + mixSec) when nothing
              // is splittable yet (single full segment, no edits).
              const clampedMixCurrentSec = Math.min(mixCurrentSec, currentMixDur);
              const playheadMixSec = scrubSec ?? clampedMixCurrentSec;
              const playheadMapping = mixTimeToOriginal(playheadMixSec, currentSegments);
              const playheadTimelineSec = playheadMapping?.origSec ?? (trimStart + playheadMixSec);
              const playheadLeftPx = TRACK_LABEL_WIDTH + playheadTimelineSec * pixelsPerSec;
              // Show the playhead as soon as the page has a recording — it
              // anchors at 0s by default so users can see where the cursor
              // sits, click anywhere to move it, and use the Split button
              // without first having to hit Play.
              const showPlayhead = true;
              // Click/drag on the timeline seeks the mix player. The scrub
              // viewport's getBoundingClientRect gives screen coords; we
              // add scrollLeft to land in CONTENT coords, then subtract
              // the label column to land in TIMELINE coords.
              const handleScrubFromClientX = (clientX: number, commit: boolean) => {
                const stackEl = trackStackRef.current;
                if (!stackEl) return;
                const rect = stackEl.getBoundingClientRect();
                const offsetPx = clientX - rect.left + stackEl.scrollLeft - TRACK_LABEL_WIDTH;
                const timelineSec = Math.max(0, offsetPx / pixelsPerSec);
                // Map original-time click into mix-time. If the click lands
                // inside a segment, originalToMixTime returns the right
                // mix-second. If it lands in a gap (or outside all segments),
                // snap to whichever segment edge is closest in original-time.
                let mixSec = originalToMixTime(timelineSec, currentSegments);
                if (mixSec === null) {
                  // Find the closest segment edge in original time.
                  let bestOrig = currentSegments[0]?.startSec ?? 0;
                  let bestDelta = Infinity;
                  for (const seg of currentSegments) {
                    for (const candidate of [seg.startSec, seg.endSec]) {
                      const d = Math.abs(candidate - timelineSec);
                      if (d < bestDelta) {
                        bestDelta = d;
                        bestOrig = candidate;
                      }
                    }
                  }
                  mixSec = originalToMixTime(bestOrig, currentSegments) ?? 0;
                }
                const totalDur = mixTotalSec || totalMixDuration(currentSegments) || timelineSpan;
                mixSec = Math.max(0, Math.min(totalDur, mixSec));
                if (commit) {
                  mixPlayerRef.current?.seek(mixSec);
                  setMixCurrentSec(mixSec);
                  setScrubSec(null);
                } else {
                  setScrubSec(mixSec);
                }
              };
              // Inner content width = label column + the entire time axis.
              // The scroll viewport (trackStackRef) clips this to whatever
              // width is available; users scroll horizontally to reach
              // content past the right edge.
              const contentWidthPx = TRACK_LABEL_WIDTH + timelineSpan * pixelsPerSec;
              return (
                <div
                  ref={trackStackRef}
                  className="overflow-x-auto overflow-y-hidden overscroll-x-contain"
                >
                  <div className="relative" style={{ width: contentWidthPx }}>
                  {/* Seek strip — covers the entire timeline area (ruler +
                      voice + SFX rows) so clicks anywhere set the playhead.
                      SFX clips and the playhead drag handle sit above
                      this via higher z-index and stopPropagation, so they
                      keep their own click semantics. */}
                  <div
                    onPointerDown={(e) => {
                      (e.target as Element).setPointerCapture(e.pointerId);
                      handleScrubFromClientX(e.clientX, false);
                    }}
                    onPointerMove={(e) => {
                      if (scrubSec === null) return;
                      handleScrubFromClientX(e.clientX, false);
                    }}
                    onPointerUp={(e) => {
                      try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                      handleScrubFromClientX(e.clientX, true);
                    }}
                    onPointerCancel={() => setScrubSec(null)}
                    className="absolute top-0 bottom-0 cursor-pointer z-10"
                    style={{ left: TRACK_LABEL_WIDTH, width: timelineSpan * pixelsPerSec }}
                    aria-label="Scrub playback"
                    role="slider"
                    aria-valuemin={0}
                    aria-valuemax={timelineSpan}
                    aria-valuenow={playheadMixSec}
                  />
                  {/* Playhead — wraps a 13px-wide invisible drag handle
                      centered on a 1px visible line. The whole handle is
                      hit-testable so the user can grab the playhead from
                      anywhere along its vertical run, not just the ruler.
                      Sits above clips (z-20) so dragging the playhead
                      wins over dragging an underlying SFX clip. */}
                  {showPlayhead && (
                    <div
                      className="absolute top-0 bottom-0 z-20 cursor-ew-resize"
                      style={{ left: playheadLeftPx - 6, width: 13 }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        (e.target as Element).setPointerCapture(e.pointerId);
                        // Start the scrub at the playhead's current
                        // position (don't snap to clientX yet — user is
                        // grabbing the line, not seeking somewhere else).
                        setScrubSec(playheadMixSec);
                      }}
                      onPointerMove={(e) => {
                        if (scrubSec === null) return;
                        handleScrubFromClientX(e.clientX, false);
                      }}
                      onPointerUp={(e) => {
                        try { (e.target as Element).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
                        if (scrubSec !== null) handleScrubFromClientX(e.clientX, true);
                      }}
                      onPointerCancel={() => setScrubSec(null)}
                      aria-label="Drag playhead"
                      role="slider"
                      aria-valuemin={0}
                      aria-valuemax={timelineSpan}
                      aria-valuenow={playheadMixSec}
                    >
                      {/* Visible 1px line centered in the handle. */}
                      <div className="absolute inset-y-0 left-1/2 -ml-px w-px bg-red-500 pointer-events-none" />
                      {/* Cursor head at the top — slightly bigger so it
                          reads as a draggable target. */}
                      <div className="absolute -top-1 left-1/2 -ml-[5px] w-[10px] h-[10px] rounded-full bg-red-500 border-2 border-white shadow pointer-events-none" />
                    </div>
                  )}
                  <TimelineRuler pixelsPerSec={pixelsPerSec} timelineSpan={timelineSpan} />
                  <TrackRow
                    label="Voice"
                    sublabel={`${formatTime(recordingDur)}${currentTrim ? ' · trimmed' : ''}`}
                    action={
                      savedPages.has(currentPageIndex) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-700">
                          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                          Saved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-amber-700">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                          Unsaved
                        </span>
                      )
                    }
                  >
                    {/* relative z-[15] lifts the waveform above the seek
                        strip (z-10) so WaveSurfer's trim region handles
                        receive pointer events instead of the strip
                        kicking the playhead on every drag attempt. Match
                        is intentional with the SFX clips' z-[15]. */}
                    <div
                      onClick={(e) => {
                        // Map the click x position to a segment so a click
                        // on the waveform selects that segment (CapCut-style
                        // "click a clip to pick it"). If the click lands in
                        // a cut/gap, deselect all voice things.
                        setSelectedEffectId(null);
                        setSelectedCutIdx(null);
                        setSelectedMusicId(null);
                        const rect = e.currentTarget.getBoundingClientRect();
                        const xPx = e.clientX - rect.left - 4; // -4 for p-1 padding
                        const clickedOriginalSec = xPx / pixelsPerSec;
                        const segIdx = currentSegments.findIndex(
                          (s) => clickedOriginalSec >= s.startSec && clickedOriginalSec <= s.endSec,
                        );
                        setSelectedVoiceSegmentIdx(segIdx >= 0 ? segIdx : null);
                      }}
                      className={`relative z-[15] inline-block rounded-md transition ${
                        !selectedEffectId && selectedCutIdx === null && selectedVoiceSegmentIdx === null ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-white' : 'ring-1 ring-transparent hover:ring-gray-200'
                      }`}
                      role="button"
                      aria-label="Select voice track"
                      aria-pressed={!selectedEffectId}
                    >
                      <WaveformTrimmer
                        ref={wavRef}
                        audioBlob={currentRecording.blob}
                        initialTrim={currentTrim}
                        onTrimChange={updateCurrentTrim}
                        widthPx={recordingDur * pixelsPerSec}
                      />
                      {/* Yellow tint overlays on the trimmed-out portions
                          of the source — makes "this is cut" obvious at
                          a glance. pointer-events-none so they don't
                          steal pointer events from WaveSurfer's region
                          drag handles underneath. Higher opacity so the
                          purple WaveSurfer region overlay (rendered
                          underneath) doesn't bleed through — keeps the
                          cut color consistent between inner and outer
                          trim. The +4px offsets account for the
                          trimmer's p-1 padding. */}
                      {currentTrim && currentTrim.startSec > 0 && (
                        <div
                          className="absolute top-1 left-1 bottom-1 bg-yellow-200 pointer-events-none rounded-l-sm"
                          style={{ width: currentTrim.startSec * pixelsPerSec }}
                          aria-hidden
                        />
                      )}
                      {currentTrim && currentTrim.endSec < recordingDur && (
                        <div
                          className="absolute top-1 bottom-1 bg-yellow-200 pointer-events-none rounded-r-sm"
                          style={{
                            left: currentTrim.endSec * pixelsPerSec + 4,
                            width: (recordingDur - currentTrim.endSec) * pixelsPerSec,
                          }}
                          aria-hidden
                        />
                      )}
                      {/* Selected-segment ring — purely visual overlay
                          showing which segment is the current "click
                          target" for Delete / future per-segment actions.
                          pointer-events-none so the underlying wrapper
                          still gets clicks for changing selection. */}
                      {selectedVoiceSegmentIdx !== null
                        && currentSegments[selectedVoiceSegmentIdx]
                        && (() => {
                          const s = currentSegments[selectedVoiceSegmentIdx];
                          return (
                            <div
                              className="absolute top-1 bottom-1 ring-2 ring-orange-500 ring-inset rounded-sm pointer-events-none"
                              style={{
                                left: s.startSec * pixelsPerSec + 4,
                                width: (s.endSec - s.startSec) * pixelsPerSec,
                              }}
                              aria-hidden
                            />
                          );
                        })()}
                      {/* Between-segment markers + drag handles. For each
                          inner boundary we render:
                            - A divider (touching) or a yellow band (gap)
                              for visual feedback.
                            - Two thin drag bars: one at segL.endSec, one
                              at segR.startSec. They overlap when touching
                              and separate when there's a gap. Dragging
                              either grows or closes the gap. */}
                      {currentSegments.slice(0, -1).map((seg, i) => {
                        const next = currentSegments[i + 1];
                        const gapWidth = next.startSec - seg.endSec;
                        const leftEdgePx = seg.endSec * pixelsPerSec + 4;
                        const rightEdgePx = next.startSec * pixelsPerSec + 4;
                        const HANDLE_W = 8;
                        const startBoundaryDrag = (
                          e: React.PointerEvent,
                          side: 'left' | 'right',
                        ) => {
                          e.stopPropagation();
                          (e.target as Element).setPointerCapture(e.pointerId);
                          setVoiceBoundaryDrag({
                            boundaryIdx: i,
                            side,
                            initialOriginalSec: side === 'left' ? seg.endSec : next.startSec,
                            pointerStartX: e.clientX,
                            frozenPixelsPerSec: pixelsPerSec,
                          });
                        };
                        const isCutSelected = selectedCutIdx === i && gapWidth > 0.01;
                        return (
                          <div key={`boundary-${i}`}>
                            {gapWidth > 0.01 ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEffectId(null);
                                  setSelectedVoiceSegmentIdx(null);
                                  setSelectedMusicId(null);
                                  setSelectedCutIdx(i);
                                }}
                                className={`absolute top-1 bottom-1 bg-yellow-200 transition-shadow ${
                                  isCutSelected ? 'ring-2 ring-orange-500 ring-inset' : 'hover:ring-1 hover:ring-orange-400 hover:ring-inset'
                                }`}
                                style={{ left: leftEdgePx, width: gapWidth * pixelsPerSec }}
                                aria-label={`Cut ${i + 1} (${gapWidth.toFixed(2)}s)${isCutSelected ? ', selected' : ''}`}
                                aria-pressed={isCutSelected}
                              />
                            ) : (
                              // 1px solid black at an exact integer pixel
                              // so the browser doesn't anti-alias it into
                              // a soft grey band on retina screens.
                              <div
                                className="absolute top-1 bottom-1 bg-black pointer-events-none"
                                style={{ left: Math.round(leftEdgePx), width: 1 }}
                                aria-hidden
                              />
                            )}
                            {/* Left handle — controls segL.endSec. */}
                            <div
                              onPointerDown={(e) => startBoundaryDrag(e, 'left')}
                              className="absolute top-1 bottom-1 cursor-ew-resize bg-purple-400/25 hover:bg-purple-500/55 transition-colors z-[16]"
                              style={{ left: leftEdgePx - HANDLE_W / 2, width: HANDLE_W }}
                              aria-label="Drag to adjust left side of cut"
                              role="separator"
                            />
                            {/* Right handle — controls segR.startSec.
                                Only render when separated; touching boundaries
                                share one handle visually to avoid two handles
                                stacked at the same pixel. */}
                            {gapWidth > 0.01 && (
                              <div
                                onPointerDown={(e) => startBoundaryDrag(e, 'right')}
                                className="absolute top-1 bottom-1 cursor-ew-resize bg-purple-400/25 hover:bg-purple-500/55 transition-colors z-[16]"
                                style={{ left: rightEdgePx - HANDLE_W / 2, width: HANDLE_W }}
                                aria-label="Drag to adjust right side of cut"
                                role="separator"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </TrackRow>
                  <TrackRow
                    label="Sound effects"
                    tooltip="Pick a sound from the left panel"
                  >
                    <SFXTimeline
                      effects={currentEffects}
                      pixelsPerSec={pixelsPerSec}
                      timelineSpan={timelineSpan}
                      trimStartSec={trimStart}
                      selectedEffectId={selectedEffectId}
                      onSelectEffect={(id) => { setSelectedEffectId(id); setSelectedCutIdx(null); setSelectedVoiceSegmentIdx(null); setSelectedMusicId(null); }}
                      onUpdateEffect={updateEffect}
                      onRemoveEffect={(id) => {
                        if (selectedEffectId === id) setSelectedEffectId(null);
                        removeEffect(id);
                      }}
                    />
                  </TrackRow>
                  <TrackRow
                    label="Music"
                    tooltip="Pick music from the left panel (Music tab)"
                  >
                    <SFXTimeline
                      effects={currentMusic}
                      variant="music"
                      pixelsPerSec={pixelsPerSec}
                      timelineSpan={timelineSpan}
                      trimStartSec={trimStart}
                      selectedEffectId={selectedMusicId}
                      onSelectEffect={(id) => { setSelectedMusicId(id); setSelectedEffectId(null); setSelectedCutIdx(null); setSelectedVoiceSegmentIdx(null); }}
                      onUpdateEffect={updateMusic}
                      onRemoveEffect={(id) => {
                        if (selectedMusicId === id) setSelectedMusicId(null);
                        removeMusic(id);
                      }}
                    />
                  </TrackRow>
                  </div>
                </div>
              );
            })() : (
              <div className="py-10 flex flex-col items-center justify-center">
                {!isRecording ? renderStartRecording(true) : renderRecordingInProgress(true)}
              </div>
            )}

            {/* Unified action bar. Always-visible Play on the left; when a
                SFX clip is selected the bar shows its properties; Reset +
                Delete icons on the right apply to whatever's currently
                selected (voice trim/recording when no SFX, or the SFX clip
                when one is selected). */}
            {currentRecording && (() => {
              const sel = selectedEffectId
                ? currentEffects.find((e) => e.id === selectedEffectId) ?? null
                : null;
              const selMusic = selectedMusicId
                ? currentMusic.find((m) => m.id === selectedMusicId) ?? null
                : null;
              // Whichever clip is selected (SFX or music) drives the
              // toolbar's "selected clip" affordances — they're identical
              // shapes, only the update/remove callbacks differ.
              const selectedClip = sel ?? selMusic;
              const selectedClipKind: 'sfx' | 'music' | null = sel ? 'sfx' : selMusic ? 'music' : null;
              const clipNeedsReset = selectedClip
                ? (selectedClip.sourceOffsetSec > 0 || selectedClip.durationSec < selectedClip.sound.duration_sec)
                : false;
              const canReset = selectedClip ? clipNeedsReset : !!currentTrim;
              const handleReset = () => {
                if (selectedClip) {
                  const patch = {
                    sourceOffsetSec: 0,
                    durationSec: selectedClip.sound.duration_sec,
                    startSec: selectedClip.startSec,
                  };
                  if (selectedClipKind === 'music') updateMusic(selectedClip.id, patch);
                  else updateEffect(selectedClip.id, patch);
                } else {
                  resetCurrentTrim();
                }
              };
              const handleUnifiedDelete = () => {
                if (sel) {
                  setSelectedEffectId(null);
                  removeEffect(sel.id);
                } else if (selMusic) {
                  setSelectedMusicId(null);
                  removeMusic(selMusic.id);
                } else if (selectedCutIdx !== null) {
                  void deleteCutAt(selectedCutIdx);
                } else if (selectedVoiceSegmentIdx !== null) {
                  void deleteSegmentAt(selectedVoiceSegmentIdx);
                } else {
                  deleteRecording();
                }
              };
              const deleteTitle = selectedClip
                ? `Remove "${selectedClip.sound.name}"`
                : selectedCutIdx !== null
                  ? 'Delete cut (removes the audio permanently)'
                  : selectedVoiceSegmentIdx !== null
                    ? `Delete voice segment ${selectedVoiceSegmentIdx + 1} (removes the audio permanently)`
                    : 'Delete recording';
              const resetTitle = selectedClip ? 'Reset clip to full source' : 'Reset voice trim';
              // Split availability — three paths:
              //   - SFX clip selected: split that clip at the playhead.
              //   - Music clip selected: split that clip at the playhead.
              //   - Nothing selected: split the voice segment under the
              //     playhead.
              const playheadMix = scrubSec ?? mixCurrentSec;
              const canSplitSfx = !!sel
                && playheadMix > sel.startSec + 0.05
                && playheadMix < sel.startSec + sel.durationSec - 0.05;
              const canSplitMusic = !!selMusic
                && playheadMix > selMusic.startSec + 0.05
                && playheadMix < selMusic.startSec + selMusic.durationSec - 0.05;
              const voiceSplitMapping = !selectedClip && currentRecording
                ? mixTimeToOriginal(playheadMix, currentSegments)
                : null;
              const canSplitVoice = !!voiceSplitMapping && (() => {
                const seg = currentSegments[voiceSplitMapping.segIdx];
                return voiceSplitMapping.origSec > seg.startSec + 0.05
                  && voiceSplitMapping.origSec < seg.endSec - 0.05;
              })();
              const canSplit = canSplitSfx || canSplitMusic || canSplitVoice;
              const splitTooltip = canSplit
                ? 'Split at playhead (S)'
                : selectedClip
                  ? 'Move playhead inside the selected clip first'
                  : currentRecording
                    ? 'Move playhead inside the voice to split it'
                    : 'Record audio first';
              const handleSplit = () => {
                if (canSplitSfx && sel) {
                  splitEffectAtMixTime(sel.id, playheadMix);
                } else if (canSplitMusic && selMusic) {
                  splitMusicAtMixTime(selMusic.id, playheadMix);
                } else if (canSplitVoice) {
                  splitVoiceAtMixTime(playheadMix);
                }
              };
              return (
                <div className="mt-4 flex items-center gap-3 py-2 border-t border-gray-100 text-xs">
                  <button
                    onClick={toggleMixPlayback}
                    disabled={uploading || mixLoading}
                    className="p-1.5 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center"
                    aria-label={mixPlaying ? 'Stop preview' : 'Play mix preview'}
                    title={currentEffects.length > 0 ? 'Preview the layered mix' : 'Preview the recording'}
                  >
                    {mixLoading ? (
                      <span className="w-3.5 h-3.5 text-[11px] leading-none flex items-center justify-center">…</span>
                    ) : mixPlaying ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    onClick={handleSplit}
                    disabled={!canSplit}
                    className="p-1.5 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
                    aria-label="Split clip at playhead"
                    title={splitTooltip}
                  >
                    <Scissors className="w-3.5 h-3.5" />
                  </button>
                  {/* Timeline zoom — keyboard (Cmd/Ctrl + +/-/0) and
                      Cmd/Ctrl + scroll wheel also work, the buttons here
                      are the discoverable surface. ×1.25 per click,
                      bounded to [25%, 400%]. Click the percentage to
                      reset to fit-to-viewport. */}
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={() => setZoomLevel((z) => Math.max(0.25, z / 1.25))}
                      disabled={zoomLevel <= 0.25}
                      aria-label="Zoom out timeline"
                      title="Zoom out (Cmd/Ctrl + −)"
                      className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setZoomLevel(1)}
                      aria-label="Reset zoom"
                      title="Reset zoom (Cmd/Ctrl + 0)"
                      className="px-2 py-1 rounded-md text-[11px] font-medium text-gray-700 hover:bg-gray-100 tabular-nums w-12 text-center transition-colors"
                    >
                      {Math.round(zoomLevel * 100)}%
                    </button>
                    <button
                      onClick={() => setZoomLevel((z) => Math.min(4, z * 1.25))}
                      disabled={zoomLevel >= 4}
                      aria-label="Zoom in timeline"
                      title="Zoom in (Cmd/Ctrl + +)"
                      className="p-1.5 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {selectedClip ? (() => {
                    // Dispatch updates to the right per-clip-type handler.
                    // Same patch shape, different state map.
                    const patchClip = (
                      patch: Partial<Pick<PendingEffect, 'startSec' | 'volumeDb' | 'durationSec' | 'sourceOffsetSec'>>,
                    ) => {
                      if (selectedClipKind === 'music') updateMusic(selectedClip.id, patch);
                      else updateEffect(selectedClip.id, patch);
                    };
                    return (
                      <>
                        <span className="font-medium text-gray-900 truncate max-w-[180px]" title={selectedClip.sound.name}>
                          {selectedClip.sound.name}
                        </span>
                        <label className="flex items-center gap-1.5 text-gray-600">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Start</span>
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={selectedClip.startSec}
                            onChange={(e) => patchClip({ startSec: Math.max(0, Number(e.target.value) || 0) })}
                            className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-gray-900 tabular-nums"
                            aria-label="Start time in seconds"
                          />
                          <span className="text-gray-500">s</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-gray-600">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Length</span>
                          <input
                            type="number"
                            min={0.1}
                            max={selectedClip.sound.duration_sec}
                            step={0.1}
                            value={selectedClip.durationSec}
                            onChange={(e) => patchClip({
                              durationSec: Math.max(0.1, Math.min(selectedClip.sound.duration_sec, Number(e.target.value) || 0.1)),
                            })}
                            className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-gray-900 tabular-nums"
                            aria-label="Length in seconds"
                          />
                          <span className="text-gray-500">s</span>
                        </label>
                        <label className="flex items-center gap-2 text-gray-600">
                          <span className="text-[10px] uppercase tracking-wider text-gray-500">Vol</span>
                          <input
                            type="range"
                            min={-30}
                            max={6}
                            step={1}
                            value={selectedClip.volumeDb}
                            onChange={(e) => patchClip({ volumeDb: Number(e.target.value) })}
                            className="vol-slider w-28"
                            aria-label="Volume in dB"
                          />
                          <span className="w-10 text-right text-gray-700 tabular-nums">{selectedClip.volumeDb}dB</span>
                        </label>
                      </>
                    );
                  })() : (
                    // No clip selected → voice is the "active track."
                    // Show just a volume slider (no Start/Length — voice
                    // length is managed via the WaveSurfer region +
                    // segments, not numeric inputs).
                    <>
                      <span className="font-medium text-gray-900">Voice</span>
                      <label className="flex items-center gap-2 text-gray-600">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">Vol</span>
                        <input
                          type="range"
                          min={-30}
                          max={6}
                          step={1}
                          value={currentVocalVolumeDb}
                          onChange={(e) => {
                            const next = Number(e.target.value);
                            setPageVocalVolumeDb((prev) => {
                              const map = new Map(prev);
                              map.set(currentPageIndex, next);
                              return map;
                            });
                          }}
                          className="vol-slider w-28"
                          aria-label="Voice volume in dB"
                        />
                        <span className="w-10 text-right text-gray-700 tabular-nums">{currentVocalVolumeDb}dB</span>
                      </label>
                    </>
                  )}
                  <span className="flex-1" />
                  {canReset && (
                    <button
                      onClick={handleReset}
                      disabled={uploading}
                      title={resetTitle}
                      aria-label={resetTitle}
                      className="px-2 py-1 rounded-md text-[11px] font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      Reset
                    </button>
                  )}
                  <button
                    onClick={handleUnifiedDelete}
                    disabled={uploading || deletingCut}
                    title={deletingCut ? 'Deleting…' : deleteTitle}
                    aria-label={deletingCut ? 'Deleting' : deleteTitle}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    {deletingCut ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              );
            })()}

            {/* Bottom nav row: status text on the left, page arrows grouped
                with Save & Continue on the right so the primary CTA + page
                nav cluster together (matches the visual order of "where am
                I → what happens next"). */}
            {(() => {
              const dirty = currentRecording ? isPageDirty(currentPageIndex) : false;
              const saving = savingDraftPage === currentPageIndex;
              const savedAt = draftSavedAt.get(currentPageIndex);
              const audioPageId = getAudioPageId(currentPageIndex);
              const canSaveDraft = !!currentRecording && !!audioPageId && dirty && !saving && !uploading;
              // Saved-status text for the page status area.
              let statusText = '';
              if (saving) {
                statusText = 'Saving draft…';
              } else if (dirty) {
                statusText = 'Unsaved changes';
              } else if (savedAt) {
                const ago = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
                statusText = ago < 5 ? 'Draft saved' : `Draft saved ${ago}s ago`;
              }
              return (
                <div className="mt-3 flex items-center gap-3 pt-3 border-t border-gray-200">
                  <span className="flex-1 text-xs text-gray-600 tabular-nums">
                    Page {currentPageIndex + 1} of {totalPages}
                    <span className="text-gray-400"> · </span>
                    <span className="text-green-700 font-medium">{savedPages.size}</span> saved
                    <span className="text-gray-400"> · </span>
                    {totalPages - savedPages.size} left
                    {statusText && (
                      <>
                        <span className="text-gray-400"> · </span>
                        <span className={dirty ? 'text-amber-700' : 'text-gray-500'}>{statusText}</span>
                      </>
                    )}
                  </span>
                  <button
                    onClick={handlePreviousPage}
                    disabled={uploading || currentPageIndex === 0}
                    title="Previous page"
                    aria-label="Previous page"
                    className="p-2.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => void handleSaveAsDraft(currentPageIndex)}
                    disabled={!canSaveDraft}
                    title={
                      !currentRecording ? 'Record first'
                      : !audioPageId ? 'Page not yet registered server-side'
                      : !dirty ? 'No unsaved changes'
                      : 'Save your progress (you can come back to finish later)'
                    }
                    className="px-4 py-2.5 rounded-md border border-purple-300 bg-white text-purple-700 hover:bg-purple-50 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {saving ? (
                      <span className="inline-flex items-center gap-2">
                        <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-purple-700"></div>
                        Saving…
                      </span>
                    ) : (
                      'Save draft'
                    )}
                  </button>
                  <button
                    onClick={requestSaveCurrentPage}
                    disabled={uploading || !currentRecording}
                    className="w-48 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-md hover:from-green-600 hover:to-emerald-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm"
                  >
                    {uploading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Saving…
                      </span>
                    ) : isLastPage ? (
                      'Finish'
                    ) : (
                      'Finish & Continue'
                    )}
                  </button>
                  <button
                    onClick={handleSkipPage}
                    disabled={uploading}
                    title={isLastPage ? 'Skip and finish (this page keeps AI narration)' : 'Skip page (this page keeps AI narration)'}
                    aria-label="Skip page"
                    className="p-2.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              );
            })()}
            </div>
            </div>
          </div>
        </div>
      ) : (
        // Minimized view: existing draggable mini panel.
        <div
          ref={panelRef}
          className="fixed z-50 max-w-md"
          style={{
            left: panelPosition.x ? `${panelPosition.x}px` : 'auto',
            top: panelPosition.y ? `${panelPosition.y}px` : 'auto',
            right: !panelPosition.x ? '1rem' : 'auto',
            bottom: !panelPosition.y ? '1rem' : 'auto',
            cursor: isDragging ? 'grabbing' : 'auto',
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 border-2 border-purple-200 w-80">
            <div
              onMouseDown={handleDragStart}
              className="flex items-center justify-between mb-2 cursor-grab active:cursor-grabbing"
            >
              <h3 className="text-sm font-bold text-gray-900">🎙️ Recording Mode</h3>
              <div className="flex items-center gap-1">
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setExpanded(true)}
                  aria-label="Maximize recorder"
                  title="Maximize to see text + trim audio"
                  className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClose}
                  aria-label="Close recording mode"
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3 px-1">
              {statusLine}
              {languageToggle}
            </div>

            {navAndSaveButtons('sm')}

            <div className="rounded-md p-3 border border-gray-100">
              <div className="mb-3 text-center">
                <span className="text-xs font-semibold text-gray-700">Page {currentPageIndex + 1} of {totalPages}</span>
              </div>

              {currentRecording ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    {savedPages.has(currentPageIndex) ? (
                      <>
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-green-700 font-semibold text-sm">✅ Saved ({formatTime(currentRecording.duration)})</span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                        <span className="text-yellow-700 font-semibold text-sm">
                          🟡 Recorded ({formatTime(currentRecording.duration)}){currentTrim ? ' · trimmed' : ''}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={isPlaying ? stopPreview : playPreview}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-semibold shadow-lg transition-all text-sm"
                    >
                      {isPlaying ? '⏹️ Stop' : '▶️ Play'}
                    </button>
                    <button
                      onClick={() => setExpanded(true)}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-semibold shadow-lg transition-all text-sm"
                    >
                      ✂️ Trim audio
                    </button>
                    <button
                      onClick={deleteRecording}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold shadow-lg transition-all text-sm"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ) : !isRecording ? (
                renderStartRecording(false)
              ) : (
                renderRecordingInProgress(false)
              )}
            </div>
          </div>
        </div>
      )}
      {mergeConfirmOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-confirm-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <h3 id="merge-confirm-title" className="text-base font-semibold text-gray-900 mb-2">
              Merge voice and sound effects?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Saving this page will mix your voice and sound effects into a single audio file. After that, you can re-record or replace it, but the voice and sound effects can no longer be edited separately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setMergeConfirmOpen(false)}
                disabled={uploading}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setMergeConfirmOpen(false);
                  void handleSaveCurrentPage();
                }}
                disabled={uploading}
                className="px-4 py-2 rounded-md bg-green-600 text-white hover:bg-green-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Save & merge
              </button>
            </div>
          </div>
        </div>
      )}
      {navConfirm && (
        <div
          className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="nav-confirm-title"
        >
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <h3 id="nav-confirm-title" className="text-base font-semibold text-gray-900 mb-2">
              Save your draft before leaving?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              You have unsaved edits on this page. Save them so you can come back to finish later, or discard them.
            </p>
            <div className="flex justify-between gap-2">
              <button
                onClick={() => {
                  const proceed = navConfirm.proceed;
                  setNavConfirm(null);
                  discardCurrentPageEdits();
                  proceed();
                }}
                disabled={savingDraftPage !== null}
                className="px-4 py-2 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50 text-sm font-medium transition-colors disabled:opacity-50"
              >
                Discard
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setNavConfirm(null)}
                  disabled={savingDraftPage !== null}
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    const proceed = navConfirm.proceed;
                    const ok = await handleSaveAsDraft(currentPageIndex);
                    if (ok) {
                      setNavConfirm(null);
                      proceed();
                    }
                    // On failure, leave the dialog open so the user can retry.
                  }}
                  disabled={savingDraftPage !== null}
                  className="px-4 py-2 rounded-md bg-purple-600 text-white hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {savingDraftPage !== null ? 'Saving…' : 'Save draft'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
