/**
 * Continuously mirrors the in-progress story to on-device storage (IndexedDB)
 * so a refresh or crash can never lose the child's work. Independent of the
 * network, auth, and whether a server draft exists yet.
 *
 * Generic on the snapshot shape — the create page owns the concrete type and
 * supplies build/apply. This hook only handles the debounced write.
 */

'use client';

import { useEffect, useRef } from 'react';
import { saveLocalDraft } from '@/lib/drafts/localDraft';

export interface UseLocalDraftBackupOptions<T> {
  /** Back up only when there is meaningful content worth protecting. */
  enabled: boolean;
  /** Debounce after the last edit before writing to IndexedDB. */
  debounceMs?: number;
  /** Server draft id this work belongs to (null until the first save). */
  projectId: string | null;
  /** Builds the serializable snapshot from current editor state. */
  buildSnapshot: () => T;
  /** Any change re-arms the debounce. */
  fingerprint: unknown[];
}

export function useLocalDraftBackup<T>({
  enabled,
  debounceMs = 800,
  projectId,
  buildSnapshot,
  fingerprint,
}: UseLocalDraftBackupOptions<T>): void {
  const buildRef = useRef(buildSnapshot);
  useEffect(() => {
    buildRef.current = buildSnapshot;
  }, [buildSnapshot]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveLocalDraft(buildRef.current(), projectId);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, debounceMs, projectId, ...fingerprint]);
}
