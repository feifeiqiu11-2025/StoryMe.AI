/**
 * Local-first draft backup (on-device, survives refresh/crash).
 *
 * A single "current in-progress draft" snapshot per browser, stored in
 * IndexedDB via idb-keyval. This is the durable copy that does NOT depend on
 * the network, auth, or the server draft existing — so a tab crash before a
 * successful save can never lose the child's work.
 *
 * Generic on the payload shape: the create page owns the concrete `data` type
 * (see useLocalDraftBackup). All operations are best-effort and never throw
 * into the editor.
 */

import { get, set, del } from 'idb-keyval';

const KEY = 'kw:create-draft:v1';
const VERSION = 1;

export interface LocalDraftEnvelope<T> {
  version: number;
  /** ISO timestamp of this snapshot — used to reconcile against the server draft. */
  savedAt: string;
  /** Server draft id this snapshot belongs to, or null for a not-yet-saved story. */
  projectId: string | null;
  data: T;
}

export async function saveLocalDraft<T>(data: T, projectId: string | null): Promise<void> {
  try {
    const env: LocalDraftEnvelope<T> = {
      version: VERSION,
      savedAt: new Date().toISOString(),
      projectId,
      data,
    };
    await set(KEY, env);
  } catch {
    // Best-effort: a failed local backup must never disrupt the editor.
  }
}

export async function loadLocalDraft<T>(): Promise<LocalDraftEnvelope<T> | null> {
  try {
    const env = await get<LocalDraftEnvelope<T>>(KEY);
    if (!env || env.version !== VERSION) return null;
    return env;
  } catch {
    return null;
  }
}

export async function clearLocalDraft(): Promise<void> {
  try {
    await del(KEY);
  } catch {
    // ignore
  }
}
