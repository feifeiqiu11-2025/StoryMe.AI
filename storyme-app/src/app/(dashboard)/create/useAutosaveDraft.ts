/**
 * Autosave hook for the story creation page.
 *
 * Schedules a silent draft save `debounceMs` after the last edit to any of
 * the `fingerprint` dependencies. Safe to mount even when disabled — it
 * no-ops until `enabled` is true. Never queues; if a save (manual or auto)
 * is already in flight, the tick is skipped and the timer re-arms on the
 * next edit. Emits PostHog telemetry for fired / failed / skipped cycles.
 *
 * Manual saves aren't performed here — the caller notifies us via
 * `markManualSaveStart/Success/Failed` so the shared pill state stays
 * consistent and the min-gap guard applies across both paths.
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  autosaveFired,
  autosaveFailed,
  autosaveSkipped,
  type AutosaveSkipReason,
} from '@/lib/telemetry/save-events';

export type AutosaveUiState = 'idle' | 'saving' | 'saved' | 'unsaved_images' | 'paused';

export interface RunAutosaveResult {
  ok: boolean;
  skippedReason?: AutosaveSkipReason;
  sceneCount: number;
  errorMessage?: string;
}

export interface UseAutosaveDraftOptions {
  enabled: boolean;
  debounceMs: number;
  /** Minimum gap between autosaves — prevents thrash right after a manual save. */
  minGapMs?: number;
  runAutosave: () => Promise<RunAutosaveResult>;
  /** Any change to these re-arms the timer. */
  fingerprint: unknown[];
}

export interface UseAutosaveDraftReturn {
  lastSavedAt: Date | null;
  uiState: AutosaveUiState;
  markManualSaveStart: () => void;
  markManualSaveSuccess: () => void;
  markManualSaveFailed: () => void;
}

export function useAutosaveDraft({
  enabled,
  debounceMs,
  minGapMs = 60_000,
  runAutosave,
  fingerprint,
}: UseAutosaveDraftOptions): UseAutosaveDraftReturn {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [uiState, setUiState] = useState<AutosaveUiState>('idle');

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoInFlightRef = useRef(false);
  const manualInFlightRef = useRef(false);
  const lastSaveMsRef = useRef<number>(0);
  const consecutiveFailuresRef = useRef(0);
  const pausedRef = useRef(false);
  const lastSavedAtRef = useRef<Date | null>(null);

  const runAutosaveRef = useRef(runAutosave);
  useEffect(() => {
    runAutosaveRef.current = runAutosave;
  }, [runAutosave]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const tick = useCallback(async () => {
    timerRef.current = null;

    if (pausedRef.current) {
      autosaveSkipped({ reason: 'paused', sceneCount: 0 });
      return;
    }
    if (autoInFlightRef.current || manualInFlightRef.current) {
      autosaveSkipped({ reason: 'save_in_flight', sceneCount: 0 });
      return;
    }
    if (lastSaveMsRef.current && Date.now() - lastSaveMsRef.current < minGapMs) {
      autosaveSkipped({ reason: 'min_gap', sceneCount: 0 });
      return;
    }

    autoInFlightRef.current = true;
    setUiState('saving');
    try {
      const result = await runAutosaveRef.current();
      if (!result.ok && result.skippedReason) {
        autosaveSkipped({ reason: result.skippedReason, sceneCount: result.sceneCount });
        setUiState(
          result.skippedReason === 'base64_pending'
            ? 'unsaved_images'
            : lastSavedAtRef.current
              ? 'saved'
              : 'idle'
        );
        return;
      }
      if (!result.ok) {
        autosaveFailed({ errorMessage: result.errorMessage || 'unknown' });
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) {
          pausedRef.current = true;
          setUiState('paused');
        } else {
          setUiState(lastSavedAtRef.current ? 'saved' : 'idle');
        }
        return;
      }
      autosaveFired({ sceneCount: result.sceneCount });
      consecutiveFailuresRef.current = 0;
      lastSaveMsRef.current = Date.now();
      const now = new Date();
      lastSavedAtRef.current = now;
      setLastSavedAt(now);
      setUiState('saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      autosaveFailed({ errorMessage: msg });
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= 2) {
        pausedRef.current = true;
        setUiState('paused');
      } else {
        setUiState(lastSavedAtRef.current ? 'saved' : 'idle');
      }
    } finally {
      autoInFlightRef.current = false;
    }
  }, [minGapMs]);

  // Re-arm the debounce on any fingerprint change while enabled.
  useEffect(() => {
    if (!enabled) {
      clearTimer();
      return;
    }
    // Any fresh edit clears the paused state — user is active again.
    if (pausedRef.current) {
      pausedRef.current = false;
      consecutiveFailuresRef.current = 0;
      setUiState(lastSavedAtRef.current ? 'saved' : 'idle');
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      void tick();
    }, debounceMs);
    return clearTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, ...fingerprint]);

  // Cleanup on unmount.
  useEffect(() => clearTimer, [clearTimer]);

  const markManualSaveStart = useCallback(() => {
    manualInFlightRef.current = true;
    setUiState('saving');
  }, []);

  const markManualSaveSuccess = useCallback(() => {
    manualInFlightRef.current = false;
    consecutiveFailuresRef.current = 0;
    pausedRef.current = false;
    lastSaveMsRef.current = Date.now();
    const now = new Date();
    lastSavedAtRef.current = now;
    setLastSavedAt(now);
    setUiState('saved');
  }, []);

  const markManualSaveFailed = useCallback(() => {
    manualInFlightRef.current = false;
    // Leave lastSavedAt alone — the prior value is still accurate.
    // Don't flip to 'paused' from a manual failure; the user saw an explicit error.
    setUiState(lastSavedAtRef.current ? 'saved' : 'idle');
  }, []);

  return {
    lastSavedAt,
    uiState,
    markManualSaveStart,
    markManualSaveSuccess,
    markManualSaveFailed,
  };
}
