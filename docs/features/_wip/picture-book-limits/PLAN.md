# Plan: Picture-book limits (scene cap + per-image edit cap)

Status: **awaiting approval** (no code yet). Created 2026-06-29. Separate PR from the reference-consistency work.

Two production limits to prevent abuse / runaway cost:
1. **Scene cap** — a picture book is at most **15 scenes + 1 cover = 16 images**. Hard limit, surfaced
   early with a clear message; no auto-truncation.
2. **Per-image edit cap** — each scene image and the cover can be edited at most **6 times**,
   **persistent** (survives reload / next-day / same story across devices). Edit path only.

Scope: **main create flow only**. Regenerate path is hidden from the UI → not guarded.

---

## Ask 1 — Scene cap (15 + cover)

**Behavior**
- Block **before caption generation**: the "generate captions" step is `handleEnhanceScenes`
  (`src/app/(dashboard)/create/page.tsx:785`). If `parseScriptIntoScenes(scriptInput).length > 15`,
  show a clear message and **stop** — do not enhance, do not truncate.
- Also surface it at the script field (live count / inline warning) so the user sees it as they type,
  not only on submit.
- **Production message** (remove the "POC" wording at `src/lib/scene-parser.ts:128`):
  e.g. *"Picture books can have up to 15 scenes. Please shorten your story to 15 scenes or fewer to continue."*
- Cover is auto-added as the 16th image, so the user-facing limit is **15 scenes**.

**Changes**
- `src/lib/scene-parser.ts`: add `export const MAX_PICTURE_BOOK_SCENES = 15;` use it in `validateScript`;
  rewrite the message (no "POC").
- `src/app/(dashboard)/create/page.tsx`: guard `handleEnhanceScenes` (and the script-input UX) on the cap.
- **Backstop (recommended):** `src/app/api/generate-images/route.ts` rejects (NOT truncates) when
  `scenes.length > MAX_PICTURE_BOOK_SCENES`, with the same message — so the limit holds even if the UI is bypassed.

**Scope:** medium-small. No DB. No migration.

---

## Ask 2 — Per-image edit cap (6, persistent, edit path only)

**Counting model (confirmed):** every **successful edit generation** counts — accept-or-not — because each
`/api/edit-image` call is a real image generation. **Failed generations don't count.** Limit = **6 per image**.

**Storage (small migration)** — `supabase/migrations/YYYYMMDD_add_edit_counts.sql`:
- `ALTER TABLE scenes ADD COLUMN edit_count INT NOT NULL DEFAULT 0;`
- `ALTER TABLE projects ADD COLUMN cover_edit_count INT NOT NULL DEFAULT 0;`
- Existing rows backfill to 0 (everyone starts with a full budget).

**Enforcement — `src/app/api/edit-image/route.ts` (the one authoritative place):**
- Add `projectId` to the request (needed for the cover; scenes resolve via `imageId` = sceneId).
- `const MAX_EDITS_PER_SCENE = 6;` (its own constant — NOT shared with the character flow's `MAX_ATTEMPTS`,
  so the two can diverge later).
- **Pre-check:** read the current count (scene → `scenes.edit_count` by sceneId; cover →
  `projects.cover_edit_count` by projectId). If `>= 6`, return a clear message and **do not generate**.
- Generate. **On success only**, atomically increment:
  `UPDATE … SET edit_count = edit_count + 1 WHERE id = … AND edit_count < 6 RETURNING edit_count`
  (the `AND … < 6` makes it race-proof — concurrent spam can't push past 6).
- Return `editsRemaining` in the response so the UI updates live.

**Surface the count to the UI:**
- The editor's data load includes `edit_count` per scene + `cover_edit_count` for the project
  (pin down exact load path during build — create-flow restore + the project/story detail fetch).
- Pass down to `ImageGallery` → `EditImageControl`.
- `EditImageControl` (`src/components/story/EditImageControl.tsx`): new props `projectId` + `editsRemaining`;
  show "X edits left", disable the edit button at 0, show the limit message on a blocked response, and
  update remaining from the edit response.

**Scope:** medium-large. 2-column migration + atomic enforce/increment in one route + count surfaced to UI +
`projectId` threading for covers. No regenerate changes.

---

## Ask 3 — Consistency
No shared constant. `MAX_PICTURE_BOOK_SCENES` and `MAX_EDITS_PER_SCENE` are independent of the character
flow's `MAX_ATTEMPTS`, so each number can change separately later.

---

## Risks / edge cases
- **Re-generating the whole story** may create new `scenes` rows → `edit_count` resets to 0 (a fresh batch =
  fresh edit budget). Could be seen as a reset loophole; flag for product decision (likely acceptable —
  re-batching is itself rate-limited per user).
- **Concurrency:** handled by the atomic `… AND edit_count < 6` guard.
- **Existing stories:** backfill to 0 → full budget on first edit after deploy.
- **Cover identity:** cover isn't a scene row; counted on `projects.cover_edit_count` via `projectId`.
- Per-user image rate limit (daily/hourly/trial-total) still applies on top, unchanged.

## Validation
- Migration applies cleanly; existing rows = 0.
- tsc clean; localhost: type a 16-scene script → blocked with the production message before captions; edit a
  scene 6× → 7th blocked; reload → count persists; edit the cover → counted separately.

## Rollout
- Separate branch off latest `origin/main` (after the reference-consistency PR merges, since both touch
  `edit-image/route.ts`). Validate on localhost. Hold for explicit push authorization.
