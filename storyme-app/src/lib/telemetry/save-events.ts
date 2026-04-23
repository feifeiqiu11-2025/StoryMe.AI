/**
 * Typed helpers for save-flow telemetry events.
 *
 * All events are named `save.*` or `autosave.*` for easy filtering in PostHog.
 * Property names are stable contracts — don't rename without checking dashboards.
 *
 * DO NOT include story content, scene captions, or author names in properties.
 */

'use client';

import { capture } from './posthog';

type SaveType = 'completed' | 'draft';

export function saveClicked(props: {
  type: SaveType;
  sceneCount: number;
  hasCover: boolean;
  hasCharacters: boolean;
}): void {
  capture('save.clicked', props);
}

export function savePreuploadStarted(props: { base64Count: number }): void {
  capture('save.preupload.started', props);
}

export function savePreuploadFailed(props: { sceneNumber: number; error: string }): void {
  capture('save.preupload.failed', {
    sceneNumber: props.sceneNumber,
    // Truncate to avoid accidentally shipping long content
    error: String(props.error).slice(0, 200),
  });
}

export function saveRequestSent(props: {
  type: SaveType;
  payloadBytes: number;
  sceneCount: number;
  hasBase64Urls: boolean;
}): void {
  capture('save.request.sent', props);
}

export function saveRequestSucceeded(props: {
  type: SaveType;
  projectId: string | undefined;
  durationMs: number;
}): void {
  capture('save.request.succeeded', props);
}

export function saveRequestFailed(props: {
  type: SaveType;
  status: number;
  errorMessage: string;
  durationMs: number;
}): void {
  capture('save.request.failed', {
    type: props.type,
    status: props.status,
    errorMessage: String(props.errorMessage).slice(0, 300),
    durationMs: props.durationMs,
  });
}

export function autosaveFired(props: { sceneCount: number }): void {
  capture('autosave.fired', props);
}

export function autosaveFailed(props: { errorMessage: string }): void {
  capture('autosave.failed', {
    errorMessage: String(props.errorMessage).slice(0, 200),
  });
}

export type AutosaveSkipReason =
  | 'base64_pending'
  | 'payload_too_large'
  | 'save_in_flight'
  | 'min_gap'
  | 'paused';

export function autosaveSkipped(props: { reason: AutosaveSkipReason; sceneCount: number }): void {
  capture('autosave.skipped', props);
}
