/**
 * Chapter-book audio buttons, split into two named exports so the Story
 * Actions and Publishing sections of the detail page can each render the
 * buttons that belong in their section while preserving picture-book
 * visual parity. Each export fetches audio-pages independently — two tiny
 * GETs is cheap and keeps state local; sharing via context would be
 * over-engineering for two callsites on the same screen.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Recorder, { RecordingPage, SaveRecordingArgs } from '@/components/audio/Recorder';

interface AudioPageEntry {
  pageNumber: number;
  text: string;
  hasAudio: boolean;
  stale: boolean;
  audioUrl: string | null;
  audioSource: 'ai_tts' | 'user_recorded' | 'ai_voice_clone' | null;
}

interface FetchHookResult {
  pages: AudioPageEntry[] | null;
  loadError: string | null;
  refresh: () => Promise<void>;
}

interface AudioControlsProps {
  projectId: string;
  /** 1-based page number the carousel is currently showing. The recorder
      uses this to open on the same page. Keyed on pageNumber (not slide
      index) because chapter books can have blank pages that the recorder
      filters out — so slide index and recorder index don't align. */
  carouselPageNumber?: number;
  /** Fires when the recorder advances/retreats so the carousel can follow.
      Passes the new active page's 1-based pageNumber. */
  onActivePageChange?: (pageNumber: number) => void;
}

function useAudioPages(projectId: string): FetchHookResult {
  const [pages, setPages] = useState<AudioPageEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/chapter-books/${projectId}/audio-pages`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setLoadError(data.error || `Failed to load audio status (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      setPages(data.pages);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load audio status');
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);
  return { pages, loadError, refresh };
}

// ---------- Story Actions: Audio (generate) + Record + stale pill ----------

type GenerationState =
  | { kind: 'idle' }
  | { kind: 'running'; current: number; total: number }
  | { kind: 'done'; generated: number; skipped: number }
  | { kind: 'error'; message: string; pageNumber?: number };

export function ChapterBookAudioControls({
  projectId,
  carouselPageNumber,
  onActivePageChange,
}: AudioControlsProps) {
  const { pages, loadError, refresh } = useAudioPages(projectId);
  const [generation, setGeneration] = useState<GenerationState>({ kind: 'idle' });
  const [recorderOpen, setRecorderOpen] = useState(false);

  const staleCount = useMemo(() => (pages ?? []).filter((p) => p.stale).length, [pages]);
  const completedCount = useMemo(
    () => (pages ?? []).filter((p) => p.hasAudio && !p.stale).length,
    [pages],
  );
  const totalPages = pages?.length ?? 0;
  const isComplete = totalPages > 0 && completedCount === totalPages;

  const handleGenerateAudio = async () => {
    if (!pages || pages.length === 0) return;
    setGeneration({ kind: 'running', current: 0, total: pages.length });
    let generated = 0;
    let skipped = 0;
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      setGeneration({ kind: 'running', current: i + 1, total: pages.length });
      try {
        const res = await fetch(`/api/v1/chapter-books/${projectId}/generate-page-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageNumber: page.pageNumber, language: 'en' }),
        });
        const data = await res.json();
        if (!res.ok) {
          setGeneration({
            kind: 'error',
            message: data.error || `Page ${page.pageNumber} failed`,
            pageNumber: page.pageNumber,
          });
          await refresh();
          return;
        }
        if (data.skipped) skipped++;
        else generated++;
      } catch (err: any) {
        setGeneration({ kind: 'error', message: err.message || 'Network error', pageNumber: page.pageNumber });
        await refresh();
        return;
      }
    }
    setGeneration({ kind: 'done', generated, skipped });
    await refresh();
  };

  const recordingPages: RecordingPage[] = useMemo(
    () => (pages ?? []).map((p) => ({
      pageNumber: p.pageNumber,
      pageType: 'chapter_page',
      text: p.text,
    })),
    [pages],
  );

  const handleSaveRecording = useCallback(
    async ({ page, blob, duration, language, trim }: SaveRecordingArgs) => {
      const formData = new FormData();
      formData.append('pageNumber', String(page.pageNumber));
      formData.append('language', language);
      formData.append('duration', String(duration));
      if (trim) {
        formData.append('trimStart', String(trim.startSec));
        formData.append('trimEnd', String(trim.endSec));
      }
      formData.append('audio', blob, `page-${page.pageNumber}.webm`);
      try {
        const res = await fetch(`/api/v1/chapter-books/${projectId}/upload-user-audio`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) {
          return { success: false, error: data.error || `HTTP ${res.status}` };
        }
        return {
          success: true,
          audioPageId: data.audioPageId,
          audioUrl: data.audioUrl,
        };
      } catch (err: any) {
        return { success: false, error: err.message || 'Network error' };
      }
    },
    [projectId],
  );

  const disableAll = !pages || pages.length === 0 || generation.kind === 'running';

  return (
    <>
      <button
        type="button"
        onClick={handleGenerateAudio}
        disabled={disableAll}
        title={isComplete ? 'Audio is ready' : 'Auto-narrate each page with AI'}
        className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
          isComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-green-500 text-white hover:bg-green-600'
        }`}
      >
        <span aria-hidden>🎵</span>
        <span>
          {generation.kind === 'running'
            ? `Generating ${generation.current}/${generation.total}…`
            : isComplete
            ? 'Audio Ready ✓'
            : 'Audio'}
        </span>
      </button>
      {staleCount > 0 && generation.kind !== 'running' && (
        <span
          role="status"
          className="inline-flex items-center gap-1 px-2 h-7 rounded-md bg-amber-100 text-amber-800 text-xs font-medium"
          title={`${staleCount} page${staleCount === 1 ? '' : 's'} edited since last narration — click Audio to re-generate.`}
        >
          ⚠ {staleCount} out of date
        </span>
      )}
      <button
        type="button"
        onClick={() => setRecorderOpen(true)}
        disabled={disableAll}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-lg bg-pink-600 text-white text-sm font-bold hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span aria-hidden>🎤</span>
        <span>Record Audio</span>
      </button>

      {loadError && (
        <p role="alert" className="basis-full mt-2 text-xs text-red-600">{loadError}</p>
      )}
      {generation.kind === 'error' && (
        <p role="alert" className="basis-full mt-2 text-xs text-red-600">
          Generation failed at page {generation.pageNumber}: {generation.message}.{' '}
          <button type="button" onClick={handleGenerateAudio} className="underline font-semibold">
            Retry
          </button>
        </p>
      )}
      {generation.kind === 'done' && generation.generated + generation.skipped > 0 && (
        <p className="basis-full mt-2 text-xs text-green-700">
          Done — {generation.generated} generated, {generation.skipped} already current.
        </p>
      )}

      {recorderOpen && pages && pages.length > 0 && (() => {
        // Map carousel pageNumber → recorder array index. If the carousel is
        // on a blank page (filtered out of recordingPages), fall back to the
        // first narratable page ≥ the carousel's pageNumber.
        let initialIdx = 0;
        if (carouselPageNumber != null) {
          const exact = recordingPages.findIndex((p) => p.pageNumber === carouselPageNumber);
          if (exact >= 0) {
            initialIdx = exact;
          } else {
            const next = recordingPages.findIndex((p) => p.pageNumber > carouselPageNumber);
            initialIdx = next >= 0 ? next : 0;
          }
        }
        // Map of pageNumber → { audioUrl } for pages that already have a
        // server-saved recording. Drives the "Edit saved audio" affordance.
        const existingPageAudio: Record<number, { audioUrl: string }> = {};
        for (const p of pages ?? []) {
          if (p.hasAudio && p.audioUrl) {
            existingPageAudio[p.pageNumber] = { audioUrl: p.audioUrl };
          }
        }
        return (
          <Recorder
            pages={recordingPages}
            maxSecondsPerPage={300}
            initialPageIndex={initialIdx}
            onPageIndexChange={(_idx, page) => onActivePageChange?.(page.pageNumber)}
            existingPageAudio={existingPageAudio}
            onSaveRecording={handleSaveRecording}
            onClose={() => {
              setRecorderOpen(false);
              void refresh();
            }}
            onAllSaved={() => void refresh()}
          />
        );
      })()}
    </>
  );
}

// ---------- Publishing: Spotify ----------

type SpotifyState =
  | { kind: 'idle' }
  | { kind: 'publishing' }
  | { kind: 'published'; audioUrl?: string }
  | { kind: 'error'; message: string };

export function ChapterBookSpotifyButton({ projectId }: { projectId: string }) {
  const { pages } = useAudioPages(projectId);
  const [spotify, setSpotify] = useState<SpotifyState>({ kind: 'idle' });

  const totalPages = pages?.length ?? 0;
  const completedCount = (pages ?? []).filter((p) => p.hasAudio && !p.stale).length;
  const isComplete = totalPages > 0 && completedCount === totalPages;

  const handlePublishSpotify = async () => {
    setSpotify({ kind: 'publishing' });
    try {
      const res = await fetch(`/api/v1/chapter-books/${projectId}/publish-spotify`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        setSpotify({ kind: 'error', message: data.error || `HTTP ${res.status}` });
        return;
      }
      setSpotify({ kind: 'published', audioUrl: data.audioUrl });
    } catch (err: any) {
      setSpotify({ kind: 'error', message: err.message || 'Network error' });
    }
  };

  const disabled =
    !isComplete || spotify.kind === 'publishing' || spotify.kind === 'published';

  return (
    <>
      <button
        type="button"
        onClick={handlePublishSpotify}
        disabled={disabled}
        title={
          !isComplete
            ? 'Generate audio for every page before publishing'
            : spotify.kind === 'published'
            ? 'Already published to Spotify'
            : 'Publish to KindleWood podcast (Spotify)'
        }
        className={`inline-flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed ${
          spotify.kind === 'published' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white hover:bg-black'
        }`}
      >
        <span aria-hidden>🎧</span>
        <span>
          {spotify.kind === 'publishing'
            ? 'Publishing…'
            : spotify.kind === 'published'
            ? 'On Spotify ✓'
            : 'Spotify'}
        </span>
      </button>
      {spotify.kind === 'error' && (
        <p role="alert" className="basis-full mt-2 text-xs text-red-600">
          Spotify publish failed: {spotify.message}
        </p>
      )}
      {spotify.kind === 'published' && (
        <p className="basis-full mt-2 text-xs text-green-700">
          Published! It will appear on Spotify within 1-6 hours.
        </p>
      )}
    </>
  );
}
