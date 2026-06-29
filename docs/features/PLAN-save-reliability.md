# Save Reliability - Implementation Plan

**Date:** 2026-04-19
**Status:** Pending Approval
**Target:** Ship before next workshop (Saturday 2026-04-25)

---

## Problem

Two real incidents on 2026-04-19:

1. **Zachary's "Riko's Road of Revelations"** — character + images saved to Storage, but no `projects` row. Refresh wiped the script. Fully lost the story text.
2. **Noah's "Brick Bonanza"** — same pattern, same day, different kid.

Both had to be manually reconstructed from Storage (see `recovered-riko-story/` and `recovered-noah-story/`). Without that recovery work both stories would be permanently gone.

### Evidence

- `api_usage_logs` shows **zero** `/api/projects/save` or `/api/projects/save-draft` entries for today's failed attempts — those endpoints aren't instrumented at all. We cannot diagnose failures because we have no data.
- `uploadPendingBase64Images` ([create/page.tsx:864-899](src/app/(dashboard)/create/page.tsx#L864-L899)) swallows upload failures with `console.warn("keeping as-is")` and proceeds — a failed upload can push a 6MB base64 payload to `/api/projects/save` and hit Vercel's 4.5MB body limit.
- No autosave, no `onbeforeunload`, no retry ([create/page.tsx:1081-1274](src/app/(dashboard)/create/page.tsx#L1081-L1274)).
- Pre-save does 20-60s of serial work (upload base64 → create characters → save) with no user feedback and no timeout protection.

### Likely root causes (ranked)

1. Pre-save chain exceeds Vercel function timeout → user closes modal → save never fires.
2. Silent failure in `uploadPendingBase64Images` → base64 makes it into save payload → 413 Payload Too Large.
3. User navigates away while "saving..." → no `onbeforeunload` guard.
4. Partial DB state from non-transactional `saveCompletedStory` ([project.service.ts:498-677](src/lib/services/project.service.ts#L498-L677)).

We won't know which without observability. **Day 1 is observability.**

---

## Goals

- **Primary:** No kid loses a story silently in next Saturday's workshop.
- **Secondary:** Every save attempt is diagnosable within 5 minutes via PostHog + `api_usage_logs`.
- **Non-goal for this plan:** Full draft-first rewrite (deferred to future sprint).

---

## Decisions (locked in with stakeholder)

| Decision | Choice | Rationale |
|---|---|---|
| Observability stack | PostHog | Session replay solves user-flow bugs; free tier covers workshop scale |
| Autosave interval | 3-min debounce (not fixed interval) | Avoid save storms; save *after* last edit |
| Feature flag default | ON | Current state is worse than any reasonable autosave bug; kill switch is env var flip |
| Workshop accounts | Per-kid (going forward) | Eliminates race-overwrite class of bug |
| Guest mode | Drop, legacy | No special handling |

---

## Plan

### Day 1 — Observability (Mon, ~4h)

#### 1.1 Install PostHog

**Files:**
- `package.json` — add `posthog-js`
- `src/app/layout.tsx` — provider
- New file: `src/lib/telemetry/posthog.ts` — singleton client, helper `captureSaveEvent`

**Config:**
```ts
posthog.init(KEY, {
  api_host: '/ingest', // reverse-proxied through Next.js, avoids adblockers
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '*', // conservative for COPPA
  },
  persistence: 'localStorage',
});
```

**COPPA/privacy:**
- `maskAllInputs: true` to hide typed text in replays.
- 30-day retention set in PostHog project settings (not in code).
- Workshop consent form to include a line about session recording.

#### 1.2 Instrument save endpoints

**Files:**
- `src/app/api/projects/save/route.ts`
- `src/app/api/projects/save-draft/route.ts`

At the top of each handler, wrap in a try/finally that logs to `api_usage_logs` on every outcome (success, auth failure, validation failure, DB error). Mirror the pattern used in [generate-images/route.ts](src/app/api/generate-images/route.ts).

Fields to capture:
- `endpoint`, `method`, `status_code`, `response_time_ms`, `error_message`
- `user_id` (from Supabase auth)
- Custom field in `error_message` JSON: `{ payloadBytes, sceneCount, hadBase64Urls, reason }`

#### 1.3 Client save events → PostHog

**File:** `src/app/(dashboard)/create/page.tsx`

Emit at each point in `handleSaveStory` and `handleSaveDraft`:
- `save.clicked` { type: 'completed' | 'draft', sceneCount, hasCover }
- `save.preupload.started` { base64Count }
- `save.preupload.failed` { sceneNumber, error }
- `save.request.sent` { payloadBytes }
- `save.request.succeeded` { projectId, durationMs }
- `save.request.failed` { status, errorMessage, durationMs }
- `save.nav_during_save` — fires from `beforeunload` if `isSaving === true`

All properties must be primitive types only; no story content, no kid's name in custom props (author name is user-entered data, keep it out of events).

#### 1.4 Enable Vercel Speed Insights

If not already on, flip in Vercel dashboard. No code change needed.

**Day 1 Definition of Done:**
- [ ] Every save attempt (success or fail) produces one row in `api_usage_logs` within 5s
- [ ] PostHog dashboard shows `save.clicked` → `save.request.succeeded` funnel
- [ ] Session replay captures a full save flow with text masked
- [ ] Vercel Speed Insights is recording

---

### Day 2 — Stop the bleeding (Tue, ~5h)

#### 2.1 `onbeforeunload` guard

**File:** `src/app/(dashboard)/create/page.tsx`

```tsx
useEffect(() => {
  const hasUnsavedWork =
    (enhancedScenes.length > 0 || generatedImages.length > 0) &&
    !justSaved;
  if (!hasUnsavedWork) return;
  const handler = (e: BeforeUnloadEvent) => {
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [enhancedScenes.length, generatedImages.length, justSaved]);
```

Known limitation: iOS Safari doesn't fire this on tab close. Acceptable — desktop users are the majority risk.

#### 2.2 Fail-loud uploads

**File:** `src/app/(dashboard)/create/page.tsx` — rewrite `uploadPendingBase64Images` ([lines 864-899](src/app/(dashboard)/create/page.tsx#L864-L899)).

Changes:
- Parallelize with `Promise.all` (cap concurrency at 5 with a small pool helper)
- Any upload failure → throw, abort save, show user error
- After pre-upload, assert no `imageUrl.startsWith('data:')` remains in `imageGenerationStatus` → throw if so with clear message

#### 2.3 Autosave

**File:** `src/app/(dashboard)/create/page.tsx`

Behavior:
- Runs **3 min after last edit**, not every 3 min (debounce on state change)
- **Skipped when:** `isGeneratingImages === true`, `isSaving === true`, no characters yet, no script yet
- **Mutex:** reuse existing `savingDraft` state. Manual save checks autosave mutex and vice versa.
- **Uses existing `/api/projects/save-draft`** — no new endpoint
- UI: "Saved just now" pill in top-right after successful autosave; "Saving..." dot during flight; "Couldn't save — retry" chip on failure (clickable)

Feature flag:
```ts
const autosaveEnabled = process.env.NEXT_PUBLIC_AUTOSAVE_ENABLED !== 'false';
```

Ships as `true`. Kill via Vercel env var flip.

#### 2.4 Parallelize character creates

**File:** `src/app/(dashboard)/create/page.tsx` — `handleSaveStory` [lines 1133-1202](src/app/(dashboard)/create/page.tsx#L1133-L1202).

Replace `for (const character of characters) { await ... }` with `Promise.all(characters.map(createChar))`. Concurrency cap 5.

**Day 2 Definition of Done:**
- [ ] Refresh with unsaved work triggers browser confirmation
- [ ] A synthetic base64 upload failure surfaces a visible error, does NOT proceed to save
- [ ] 3-min after edits stop, draft appears in DB with no user action
- [ ] Manual save while autosave runs — no duplicate rows, no race
- [ ] Autosave fires within 1s of kill-switch being disabled remotely

---

### Day 3 — Verify + regression test (Wed, ~2h)

#### 3.1 Manual smoke test in prod

Run each failure mode in a test account, verify each produces:
- (a) PostHog event
- (b) `api_usage_logs` row
- (c) Clear user-facing error

Modes to test:
1. Happy path save (10 scenes, 1 character)
2. Force a base64 upload to fail (block URL in DevTools) → expect loud error, no save call
3. Force save API to 500 → expect error UI, row in `api_usage_logs`
4. Refresh during save → expect `beforeunload` warning
5. Leave editor idle for 3 min → expect autosave firing + draft row + "Saved" pill

#### 3.2 One integration test

**File:** `__tests__/integration/save-flow.test.ts` (new)

Covers: create character → generate (mocked) → save → assert project + scenes + images exist in DB. Catches the most likely class of future regression.

#### 3.3 Review first 24h of telemetry

Look at PostHog funnel + `api_usage_logs`. Adjust anything surprising.

**Day 3 Definition of Done:**
- [ ] All 5 smoke-test scenarios verified
- [ ] Integration test passing in CI
- [ ] No surprise events in first 24h
- [ ] Kill-switch documented in `README.md` or `DEPLOY.md`

---

## Risks addressed

| # | Risk | Mitigation |
|---|---|---|
| 1 | Workshop kids share admin account | Per-kid accounts going forward (decision) |
| 2 | 4.5MB API body limit | Fail-loud on base64; assert no `data:` URLs before save |
| 3 | `save-draft` not logged | Day 1.2 instruments both endpoints |
| 4 | Autosave × manual save race | Shared `savingDraft`/`isSaving` mutex |
| 5 | Autosave during image generation | Skip condition in debounced trigger |
| 6 | Fixed-interval over-saves | Debounce on last edit, not interval |
| 7 | No kill switch | `NEXT_PUBLIC_AUTOSAVE_ENABLED` env var |
| 8 | `onbeforeunload` useless on mobile | Acknowledged; not the primary safety net |
| 9 | Serial character creates | Day 2.4 parallelization |
| 10 | Serial image uploads | Day 2.2 parallelization |
| 11 | No regression test | Day 3.2 integration test |
| 12 | Draft bloat in `/projects` | Out of scope; hide via status filter in follow-up |
| 13 | PII in session replay | `maskAllInputs: true` + 30d retention |
| 14 | PostHog bundle size | ~70KB gzipped, acceptable |

---

## Rollback / kill-switch

**Autosave misbehaving in prod:**
Vercel dashboard → project → Settings → Environment Variables → set `NEXT_PUBLIC_AUTOSAVE_ENABLED=false` → redeploy (fast — <2 min). Next page load picks it up. No data is lost, save-draft endpoint still exists for manual use.

**PostHog breaking something:**
Comment out provider in `src/app/layout.tsx` and redeploy. No DB dependency.

**Full revert:**
Single commit per day means `git revert <sha>` restores previous behavior cleanly.

---

## Out of scope (for this plan)

- Draft-first persistence (Tier 3 — separate plan, 2+ weeks)
- Transactional save via Postgres function (Tier 2 — revisit after Day 3 data)
- Admin recovery tool (the `recover-*-story.ts` scripts work fine ad-hoc for now)
- Sentry (we're going PostHog-only)
- Vercel Analytics for product metrics (Speed Insights only)

---

## Open questions / decisions needed before Day 1

None — all decisions are locked. Awaiting go-ahead to start.

---

## Files that will change

**New:**
- `src/lib/telemetry/posthog.ts`
- `src/lib/telemetry/save-events.ts`
- `__tests__/integration/save-flow.test.ts`

**Modified:**
- `package.json` (add `posthog-js`)
- `src/app/layout.tsx` (PostHog provider)
- `src/app/api/projects/save/route.ts` (add logging)
- `src/app/api/projects/save-draft/route.ts` (add logging)
- `src/app/(dashboard)/create/page.tsx` (beforeunload, fail-loud uploads, autosave, parallelization, client events)

**Not touched:**
- `src/lib/services/project.service.ts` (transactional save is Tier 2, out of scope)
- Database schema (no migrations this round)

---

## Timeline

| Day | Focus | Hours |
|---|---|---|
| Mon | Observability (PostHog + endpoint logging) | ~4h |
| Tue | Stop-the-bleeding fixes | ~5h |
| Wed | Verify + 1 integration test | ~2h |
| Thu-Fri | Buffer / fix based on live data | — |
| Sat | Workshop (instrumented, resilient) | — |

Total engineering: ~11h over 3 days.
