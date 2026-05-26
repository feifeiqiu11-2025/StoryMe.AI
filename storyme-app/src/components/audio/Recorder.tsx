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
import { SkipBack, SkipForward, Maximize2, Minimize2, Plus, Trash2, RotateCcw } from 'lucide-react';
import WaveformTrimmer, { TrimRange, WaveformTrimmerHandle } from './WaveformTrimmer';
import SFXPicker, { SfxLibraryItem } from './SFXPicker';
import SFXTimeline from './SFXTimeline';
import { TrackRow, TimelineRuler, TRACK_LABEL_WIDTH } from './TimelineLayout';
import { createMixPlayer, MixPlayer } from '@/lib/audio/preview-mix.client';

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

export default function Recorder({
  pages,
  defaultLanguage = 'en',
  secondaryLanguage,
  maxSecondsPerPage = 60,
  initialPageIndex = 0,
  onPageIndexChange,
  existingPageAudio,
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
  // Per-page in-memory trim range. Keyed by page index, same as pageRecordings.
  // Cleared when the user re-records the page (trim is bound to a specific take).
  const [pageTrims, setPageTrims] = useState<Map<number, TrimRange>>(new Map());
  // Per-page SFX placements pending save. Persisted via PATCH /layers after
  // the vocal upload completes (in handleSaveCurrentPage).
  const [pageEffects, setPageEffects] = useState<Map<number, PendingEffect[]>>(new Map());
  const [sfxPickerOpen, setSfxPickerOpen] = useState(false);
  const [selectedEffectId, setSelectedEffectId] = useState<string | null>(null);

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
  // Current playhead position emitted by the mix player's onProgress
  // callback. Drives the moving cursor line over the tracks; also gets
  // updated optimistically during a click/drag-to-seek gesture.
  const [mixCurrentSec, setMixCurrentSec] = useState(0);
  const [mixTotalSec, setMixTotalSec] = useState(0);
  // Local "ghost" position while scrubbing — diverges from mixCurrentSec
  // until the user releases the pointer, at which point we commit the
  // seek to the player.
  const [scrubSec, setScrubSec] = useState<number | null>(null);

  const totalPages = pages.length;
  const currentPage = pages[currentPageIndex];
  const currentRecording = pageRecordings.get(currentPageIndex);
  const currentTrim = pageTrims.get(currentPageIndex);
  const currentEffects = pageEffects.get(currentPageIndex) ?? [];
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

  // Track-stack width measurement — drives the shared pixelsPerSec across
  // the voice waveform + SFX timeline so they align at every second mark.
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
    const trim = currentTrim ? `${currentTrim.startSec.toFixed(2)}-${currentTrim.endSec.toFixed(2)}` : 'full';
    const fx = currentEffects.map((e) => `${e.id}:${e.startSec}:${e.durationSec}:${e.sourceOffsetSec}:${e.volumeDb}`).join('|');
    return `${currentRecording.url}|${trim}|${fx}`;
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
        trimRange: currentTrim,
        effects: currentEffects.map((e) => ({
          id: e.id,
          url: e.sound.audio_url,
          startSec: e.startSec,
          durationSec: e.durationSec,
          sourceOffsetSec: e.sourceOffsetSec,
          volumeDb: e.volumeDb,
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
        // Reset trim / saved markers — new take invalidates them.
        setSavedPages((prev) => {
          if (!prev.has(capturedPageIndex)) return prev;
          const next = new Set(prev);
          next.delete(capturedPageIndex);
          return next;
        });
        setPageTrims((prev) => {
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
    setSavedPages((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Set(prev);
      next.delete(currentPageIndex);
      return next;
    });
    setPageTrims((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Map(prev);
      next.delete(currentPageIndex);
      return next;
    });
  };

  const updateCurrentTrim = (range: TrimRange) => {
    setPageTrims((prev) => {
      const next = new Map(prev);
      next.set(currentPageIndex, range);
      return next;
    });
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
      // Editing a saved take = unsaved changes until next Save.
      setSavedPages((prev) => {
        if (!prev.has(pageIndex)) return prev;
        const next = new Set(prev);
        next.delete(pageIndex);
        return next;
      });
      setPageTrims((prev) => {
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
    setPageTrims((prev) => {
      if (!prev.has(currentPageIndex)) return prev;
      const next = new Map(prev);
      next.delete(currentPageIndex);
      return next;
    });
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

  /** PATCH /api/v1/audio-pages/{id}/layers with the current page's effects
      to produce a mixed MP3 server-side. Skipped if there are no effects.
      Trim is intentionally NOT sent here because the vocal upload already
      applied it destructively — the vocal file at `vocalUrl` is the trimmed
      version. */
  const applyEffectsLayer = async (
    audioPageId: string,
    vocalUrl: string,
    trimmedDurationSec: number,
    effects: PendingEffect[],
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
          },
          music: [],
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

  const handleSaveCurrentPage = async () => {
    if (!currentRecording) {
      alert('No recording for this page. Please record first.');
      return;
    }
    setUploading(true);
    try {
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

      // If the user added SFX placements, apply them as a layer-mix step
      // after the vocal upload. Requires the host's save callback to return
      // both audioPageId and audioUrl — silently skipped if either missing.
      if (currentEffects.length > 0 && result.audioPageId && result.audioUrl) {
        const trimmedDuration = currentTrim
          ? currentTrim.endSec - currentTrim.startSec
          : currentRecording.duration;
        const mixResult = await applyEffectsLayer(
          result.audioPageId,
          result.audioUrl,
          trimmedDuration,
          currentEffects,
        );
        if (!mixResult.success) {
          alert(`Vocal saved, but mixing sound effects failed: ${mixResult.error}\n\nThe page has audio without effects. Try editing the page again to retry.`);
          // Continue — vocal IS saved. Don't block the workflow.
        }
        // Note: we intentionally KEEP pageEffects in memory after a
        // successful save. Clearing them made the SFX lane look empty
        // after Save & Continue, which read as "the save lost my SFX."
        // The next save will re-PATCH the same layer spec; harmless.
      }

      setSavedPages((prev) => new Set(prev).add(currentPageIndex));

      if (currentPageIndex < totalPages - 1) {
        setCurrentPageIndex((i) => i + 1);
        if (isPlaying) stopPreview();
      } else {
        // Last page saved — notify host and exit.
        onAllSaved?.();
        handleClose();
      }
    } catch (err: any) {
      console.error('Audio upload error:', err);
      alert(`Error saving audio: ${err.message || 'Unknown error'}\n\nPlease try again.`);
    } finally {
      setUploading(false);
    }
  };

  const handleSkipPage = () => {
    if (isPlaying) stopPreview();
    if (isLastPage) {
      handleClose();
      return;
    }
    setCurrentPageIndex((i) => i + 1);
  };

  const handlePreviousPage = () => {
    if (isPlaying) stopPreview();
    if (currentPageIndex <= 0) return;
    setCurrentPageIndex((i) => i - 1);
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
        onClick={handleSaveCurrentPage}
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
        // Expanded view: centered modal with waveform trimmer + larger controls.
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-[1600px] h-[95vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
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
                  onClick={handleClose}
                  aria-label="Close recording mode"
                  className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Page text — what the user is reading. Scrolls so long chapter
                book pages don't push the controls off-screen. */}
            <div className="mb-4 max-h-40 overflow-y-auto">
              {currentPage.text ? (
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                  {currentPage.text}
                </p>
              ) : (
                <p className="text-xs text-gray-500 italic">(no narration text for this page)</p>
              )}
            </div>

            {/* Multi-track editor — voice + sound effects stacked, sharing
                one time axis. The track-stack ref measures available width;
                that drives pixelsPerSec so every clip aligns across rows. */}
            {currentRecording ? (() => {
              const recordingDur = currentRecording.duration;
              const trimStart = currentTrim?.startSec ?? 0;
              // longestClipEnd is in TIMELINE (original) time so the lane
              // width covers clips that visually extend past the vocal —
              // each clip's right edge sits at trimStart + startSec + duration.
              const longestClipEnd = currentEffects.reduce(
                (max, e) => Math.max(max, trimStart + e.startSec + e.durationSec),
                0,
              );
              const timelineSpan = Math.max(recordingDur, longestClipEnd, 5);
              const timelineColWidth = trackStackWidth - TRACK_LABEL_WIDTH;
              // pixelsPerSec is anchored to the VOCAL length only — clip
              // resize/move doesn't trigger rescale. Result: clips slide
              // smoothly under the cursor, lane just grows wider and the
              // overflow-x-auto wrapper handles scroll if content extends
              // past the viewport (matches DAW conventions). Re-recording
              // a different-length take produces a new vocalDur and
              // recalculates the scale once.
              const pixelsPerSec = Math.max(40, timelineColWidth / Math.max(recordingDur, 5));
              // mixCurrentSec / scrubSec are in MIX time (0 = trim start).
              // The visual timeline is in ORIGINAL time (0 = vocal 0:00).
              // Adding trimStart bridges the two so the playhead visually
              // tracks the trim region — at mixSec=0 we draw at the trim
              // region's left edge, not at the timeline's 0s mark.
              const playheadMixSec = scrubSec ?? mixCurrentSec;
              const playheadTimelineSec = trimStart + playheadMixSec;
              const playheadLeftPx = TRACK_LABEL_WIDTH + playheadTimelineSec * pixelsPerSec;
              const showPlayhead = mixPlaying || scrubSec !== null || mixCurrentSec > 0;
              // Click/drag on the timeline seeks the mix player. clientX is
              // in original-time pixels; convert through trimStart so the
              // mix player receives mix-time seconds.
              const handleScrubFromClientX = (clientX: number, commit: boolean) => {
                const stackEl = trackStackRef.current;
                if (!stackEl) return;
                const rect = stackEl.getBoundingClientRect();
                const offsetPx = clientX - rect.left - TRACK_LABEL_WIDTH;
                const timelineSec = offsetPx / pixelsPerSec;
                const mixSec = Math.max(0, Math.min(mixTotalSec || timelineSpan, timelineSec - trimStart));
                if (commit) {
                  mixPlayerRef.current?.seek(mixSec);
                  setMixCurrentSec(mixSec);
                  setScrubSec(null);
                } else {
                  setScrubSec(mixSec);
                }
              };
              return (
                <div ref={trackStackRef} className="relative">
                  {/* Seek strip — sits over the ruler so clicks/drags
                      anywhere on the time axis scrub the playhead. The
                      strip lives behind the playhead line via z-index. */}
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
                    className="absolute top-0 h-[22px] cursor-pointer z-10"
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
                    <div
                      onClick={() => setSelectedEffectId(null)}
                      className={`inline-block rounded-md transition ${
                        !selectedEffectId ? 'ring-2 ring-purple-400 ring-offset-2 ring-offset-white' : 'ring-1 ring-transparent hover:ring-gray-200'
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
                    </div>
                  </TrackRow>
                  <TrackRow
                    label="Sound effects"
                    sublabel={currentEffects.length > 0 ? `${currentEffects.length} layered` : undefined}
                    action={
                      <button
                        onClick={() => setSfxPickerOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    }
                  >
                    <SFXTimeline
                      effects={currentEffects}
                      pixelsPerSec={pixelsPerSec}
                      timelineSpan={timelineSpan}
                      trimStartSec={trimStart}
                      selectedEffectId={selectedEffectId}
                      onSelectEffect={setSelectedEffectId}
                      onUpdateEffect={updateEffect}
                      onRemoveEffect={(id) => {
                        if (selectedEffectId === id) setSelectedEffectId(null);
                        removeEffect(id);
                      }}
                    />
                  </TrackRow>
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
              const sfxNeedsReset = sel
                ? (sel.sourceOffsetSec > 0 || sel.durationSec < sel.sound.duration_sec)
                : false;
              const canReset = sel ? sfxNeedsReset : !!currentTrim;
              const handleReset = () => {
                if (sel) {
                  updateEffect(sel.id, {
                    sourceOffsetSec: 0,
                    durationSec: sel.sound.duration_sec,
                    startSec: sel.startSec, // keep where the user placed it
                  });
                } else {
                  resetCurrentTrim();
                }
              };
              const handleUnifiedDelete = () => {
                if (sel) {
                  setSelectedEffectId(null);
                  removeEffect(sel.id);
                } else {
                  deleteRecording();
                }
              };
              const deleteTitle = sel ? `Remove "${sel.sound.name}"` : 'Delete recording';
              const resetTitle = sel ? 'Reset clip to full source' : 'Reset voice trim';
              return (
                <div className="mt-4 flex items-center gap-3 py-2 border-t border-gray-100 text-xs">
                  <button
                    onClick={toggleMixPlayback}
                    disabled={uploading || mixLoading}
                    className="w-20 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 transition-colors disabled:opacity-50 text-sm font-medium text-center"
                    aria-label={mixPlaying ? 'Stop preview' : 'Play mix preview'}
                    title={currentEffects.length > 0 ? 'Preview the layered mix' : 'Preview the recording'}
                  >
                    {mixLoading ? '…' : mixPlaying ? '⏸ Stop' : '▶ Play'}
                  </button>
                  {sel ? (
                    <>
                      <span className="font-medium text-gray-900 truncate max-w-[180px]" title={sel.sound.name}>
                        {sel.sound.name}
                      </span>
                      <label className="flex items-center gap-1.5 text-gray-600">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500">Start</span>
                        <input
                          type="number"
                          min={0}
                          step={0.1}
                          value={sel.startSec}
                          onChange={(e) => updateEffect(sel.id, { startSec: Math.max(0, Number(e.target.value) || 0) })}
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
                          max={sel.sound.duration_sec}
                          step={0.1}
                          value={sel.durationSec}
                          onChange={(e) => updateEffect(sel.id, {
                            durationSec: Math.max(0.1, Math.min(sel.sound.duration_sec, Number(e.target.value) || 0.1)),
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
                          value={sel.volumeDb}
                          onChange={(e) => updateEffect(sel.id, { volumeDb: Number(e.target.value) })}
                          className="vol-slider w-28"
                          aria-label="Volume in dB"
                        />
                        <span className="w-10 text-right text-gray-700 tabular-nums">{sel.volumeDb}dB</span>
                      </label>
                    </>
                  ) : null}
                  <span className="flex-1" />
                  {canReset && (
                    <button
                      onClick={handleReset}
                      disabled={uploading}
                      title={resetTitle}
                      aria-label={resetTitle}
                      className="p-1.5 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={handleUnifiedDelete}
                    disabled={uploading}
                    title={deleteTitle}
                    aria-label={deleteTitle}
                    className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })()}

            {/* Bottom nav row: status text on the left, page arrows grouped
                with Save & Continue on the right so the primary CTA + page
                nav cluster together (matches the visual order of "where am
                I → what happens next"). */}
            <div className="mt-3 flex items-center gap-3 pt-3 border-t border-gray-200">
              <span className="flex-1 text-xs text-gray-600 tabular-nums">
                Page {currentPageIndex + 1} of {totalPages}
                <span className="text-gray-400"> · </span>
                <span className="text-green-700 font-medium">{savedPages.size}</span> saved
                <span className="text-gray-400"> · </span>
                {totalPages - savedPages.size} left
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
                onClick={handleSaveCurrentPage}
                disabled={uploading || !currentRecording}
                className="w-56 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-md hover:from-green-600 hover:to-emerald-600 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed py-2.5 text-sm"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Saving…
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
                className="p-2.5 rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <SkipForward className="w-4 h-4" />
              </button>
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
      <SFXPicker
        open={sfxPickerOpen}
        onClose={() => setSfxPickerOpen(false)}
        onPick={addEffect}
      />
    </>
  );
}
