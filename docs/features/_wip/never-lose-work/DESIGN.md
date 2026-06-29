# Design: Never Lose a Child's Work

**Status:** WIP — design locked, pending implementation
**Origin:** Sev A incident, 2026-06-28 — a child lost ~30 min of original story writing at a workshop. Illustrations were recovered from temporary storage; his original script was unrecoverable.
**Owner:** _TBD_

---

## 1. Background

At a creative-writing workshop, a child used a shared admin account (he'd forgotten his own), and a second child logged into the same account on another device. The first child wrote a full story, generated illustrations, and believed it was saved. It wasn't:

- His autosaves were **silently failing** — the server returned `404 "Draft project not found"` while the UI still showed "saved."
- The client **kept retrying a draft ID the saving session couldn't resolve** instead of creating a new draft.
- His work existed **only in that browser tab's memory**; nothing was written to the device or persisted server-side.
- When the tab refreshed/crashed, the only copy was gone.

We could **not** determine exactly what happened to the draft (deleted vs. invisible-to-session) because **the per-request `projectId` and request bodies are not logged**. That blind spot is itself a finding.

### What the incident exposed
- In-progress work has no durable home until a successful save.
- The raw script is only ever a transient request body to stateless AI endpoints; nothing persists or (recoverably) logs it.
- Saves can fail silently.
- The client retries dead draft IDs instead of recovering.
- Concurrent sessions on one account can collide.
- `projects` are **hard-deleted** (no `deleted_at`) — violating our own CLAUDE.md soft-delete rule.
- Observability is incomplete: half the pipeline (enhance, metadata, quiz, **deletes**) isn't logged; `projectId`/`ip`/`user_agent` aren't captured.
- Daily backups don't cover same-day create-and-loss; no PITR.

---

## 2. Goals / Non-goals

**Goals**
- A child's in-progress writing is **never** lost to a crash, refresh, failed save, or shared-account collision.
- Failures are **visible to the user** and **traceable by us**.
- Recovery is possible without forensic investigation.

**Non-goals (this phase)**
- Real-time collaborative editing (CRDT). Same-story concurrent edit = last-write-wins.
- Replacing Supabase Auth. We adjust session behavior, not the provider.
- Child profiles under a parent account — **deferred to a separate follow-up design**.

---

## 3. Principle alignment (CLAUDE.md 8)

- **Security/Privacy:** raw script persisted as the child's own access-controlled data; the 24h log backstop is redacted if any drain exists.
- **Clear API contracts:** save becomes an explicit idempotent upsert keyed on a client UUID.
- **Scalable schema:** soft-delete + partial indexes.
- **Stateless services:** unchanged — state lives in DB/IndexedDB, not server memory.
- **Reuse before rebuild:** Supabase Realtime (future presence), `idb-keyval` for local store; no custom infra.
- **Separation of concerns:** save logic stays in the service/RPC layer.

---

## 3a. Engineering quality bar — leave it cleaner

These fixes touch already-tangled code (the `create` page component is large; save logic is split across the API route, `ProjectService`, and the autosave hook). The bar: **each change leaves the touched files cleaner than it found them — no parallel paths, no accretion.**

- Put logic in the right layer (UI → API → Service → Repository). No business logic in routes or components.
- **Consolidate the save paths.** Autosave, manual save, and draft-resume should flow through **one** save/sync module and **one** server entry point — not three slightly-different copies.
- Refactor over bolt-on. If a fix would add mess, stop and propose the cleaner structure first.
- Extract the save-state machine and the local-first store as small, testable units, not inline state in the page.
- Net line count for the save flow should ideally **go down**, not up.

## 4. Decisions (locked)

| # | Decision |
|---|----------|
| Local store | **IndexedDB** via a small wrapper (`idb-keyval`). |
| Soft delete | Add `deleted_at`; DELETE sets it; reads filter it. **No automated purge job** — manual cleanup as needed. |
| Concurrency | Two devices on one account creating **separate** stories is **fully allowed** (solved by client-generated UUIDs). Same-story concurrent edit = **last-write-wins**; the overwritten device keeps its version in its own IndexedDB. |
| Child profiles | **Deferred** to a follow-up design. |
| Log drain | None found in repo/config; pending a one-glance Vercel dashboard confirm. If a drain exists, redact the script field. |

---

## 5. Phase 0 — Prevent & recover (would have prevented this incident)

### A. Durable draft identity — client UUID + idempotent upsert
- Client **mints a UUID** when a story session starts, before any network call.
- `save-draft` becomes an **upsert** keyed on that UUID (`INSERT … ON CONFLICT (id) DO UPDATE`), re-checking `user_id` ownership on the conflict path.
- A save can no longer 404 for "doesn't exist yet."
- Backward-compatible: existing drafts keep their IDs.

### B. Local-first capture — on-device autosave
- On every change to script/scenes, snapshot to **IndexedDB** keyed by draft UUID.
- On load, **reconcile**: if the local snapshot is newer (or the server draft is missing/deleted), offer "restore unsaved work."
- This is the real safety net — independent of network, auth, or server state. Also makes same-story last-write-wins non-destructive (the loser's version survives locally).

### C. Truthful save state — never silent-fail
State machine surfaced in the UI:
```
idle → saving → saved
            ↘ error(retryable) → "Couldn't save — retrying. Your work is safe on this device."
            ↘ offline          → "Offline — saved on this device, will sync."
```
- "Saved" renders **only** on a confirmed 2xx with a persisted row.
- Errors are visible, kid-appropriate, non-scary.

### D. Soft delete
- Add `deleted_at timestamptz` to `projects`.
- DELETE endpoint sets `deleted_at` instead of removing the row; scenes/images stay (hidden via the parent flag).
- All reads filter `deleted_at IS NULL`; RLS updated.
- **No purge job** — manual hard-delete when needed.

### E. Atomic save
- Move save into a **Postgres function (RPC)** so project + scenes + images write in **one transaction**.
- Prefer **upsert of scenes by `(project_id, scene_number)`** over today's "delete-all-then-reinsert," so a partial failure can't strand a draft with zero scenes.

### F. 24h input-log backstop
- At the generate/enhance step, log the raw script **once**, tagged with the trace ID.
- **Secondary** to A–C, not a replacement.
- **Privacy guardrail:** if a log drain (Axiom/Datadog) is active, redact/scrub the script field so it doesn't persist past ~24h or leave Vercel.

---

## 6. Phase 1 — Observability & real usage

### G. End-to-end trace ID + logging middleware
- Client mints a `traceId` per session; sent as a header on every call; written to logs **and** onto rows (`projects.trace_id`).
- A single middleware logs all routes uniformly: `endpoint, status, userId, deviceId, sessionId, traceId, projectId, durationMs`. Fixes today's gaps (enhance/metadata/quiz/**deletes** unlogged; `ip`/`user_agent`/`projectId` never stored).

### H. Save-failure alerting
- Alert when save/autosave error rate crosses a threshold — a burst of save failures is **data loss in progress**.

### I. Concurrent sessions (last-write-wins)
- Never log other devices out (no single-session token rotation).
- Separate stories per device: works via unique client UUIDs (Design A).
- Same-story: **last-write-wins**; overwritten version survives in that device's IndexedDB.
- Presence / "open elsewhere" warning: **optional, deferred.**

### J. Child profiles under a parent account — *separate follow-up design*
- Real fix for "two kids, one parent email": profiles with their own drafts + attribution.
- P0 already makes shared-account use *safe*; profiles make it *correct*.

---

## 7. Data model & migrations

1. `projects`: add `deleted_at timestamptz`, `trace_id text`. Index: `(user_id) WHERE deleted_at IS NULL`.
2. New Postgres function `save_draft_atomic(...)` — transactional upsert of project + scenes + images.
3. `api_usage_logs`: populate `ip_address`, `user_agent`; add `project_id`, `trace_id`, `device_id`.
4. (Deferred) purge job — not built now.

---

## 8. Rollout plan

1. **Additive migrations** (`deleted_at`, `trace_id`) — safe.
2. **Local-first (B) + save state machine (C)** — pure client, behind a flag, biggest immediate safety win, no server risk.
3. **Client UUID + upsert (A) + atomic save (E)** — backward-compatible server change.
4. **Soft delete (D).**
5. **Trace ID + logging middleware (G) + alerting (H).**
6. **Concurrent sessions (I).** Then **child profiles (J)** as a separate design.

---

## 9. Risks

- **Local/server reconcile** can resurrect stale drafts — use `updated_at` + a local dirty flag to decide "which is newer."
- **Upsert ownership** — the `ON CONFLICT` path must re-check `user_id` so a guessed UUID can't hijack another user's row.
- **Soft-delete leaks** — every existing query must add `deleted_at IS NULL` or deleted drafts reappear.
- **Last-write-wins** — acceptable per decision, but rely on Design B so the overwritten version is never truly lost.

---

## 10. Phase 0 tickets

> Acceptance criteria are written so each ticket is independently verifiable.
>
> **Applies to every ticket below (per §3a):** the change must leave the save flow cleaner — logic in the right layer, no duplicated save paths, the touched files no messier (ideally smaller). "Did this make the save flow cleaner?" is a required review check alongside the functional criteria.
>
> **Progress (uncommitted, localhost):** NLW-1 ✅ · NLW-2 ✅ · NLW-3 ✅ · NLW-6 ✅ · NLW-4 ⏳ next · NLW-5 ⏳

### NLW-1 — Client-generated draft UUID + idempotent upsert
**Why:** saves 404'd against IDs the session couldn't resolve; client retried dead IDs.
**Acceptance criteria**
- New story sessions generate a UUID client-side before any network call.
- `save-draft` accepts a client-provided `id` and upserts (`ON CONFLICT (id) DO UPDATE`), re-checking `user_id`.
- First save inserts; subsequent saves update; **no path returns 404 "draft not found"** for a normal new draft.
- Two devices on the same account creating separate stories produce two distinct rows with no collision.
- Existing drafts (server-minted IDs) continue to save correctly.

### NLW-2 — Local-first capture (IndexedDB)
**Why:** the only copy was volatile tab memory.
**Acceptance criteria**
- Script + scene edits snapshot to IndexedDB (via `idb-keyval`) on change, keyed by draft UUID.
- After a forced refresh/crash mid-edit, reopening the app offers to restore the unsaved work, and restores it correctly.
- Reconcile rule: local snapshot newer than server (or server draft missing/deleted) → restore prompt; otherwise server wins.
- Works with no network connection.

### NLW-3 — Truthful save-state machine
**Why:** UI showed "saved" while saves failed.
**Acceptance criteria**
- Save indicator reflects real state: Saving / Saved / Failed–retrying / Offline–kept on device.
- "Saved" renders only after a confirmed 2xx with a persisted row.
- A forced save failure shows a visible, kid-appropriate message — never silent.
- Retries continue without losing the local copy.

### NLW-4 — Soft delete for projects (no purge)
**Why:** hard delete = unrecoverable; violates CLAUDE.md.
**Acceptance criteria**
- `projects.deleted_at` added (migration).
- DELETE endpoint sets `deleted_at`; row + children remain.
- All project reads/lists exclude `deleted_at IS NOT NULL`; RLS updated.
- A "deleted" draft can be restored by clearing `deleted_at` (manual/admin path).
- No automated purge job.

### NLW-5 — Atomic save
**Why:** delete-all-then-reinsert can strand a draft with zero scenes.
**Acceptance criteria**
- Save writes project + scenes + images in a single transaction (RPC).
- Scenes upserted by `(project_id, scene_number)` rather than delete-all-reinsert.
- An induced mid-save failure leaves the prior draft intact (no partial wipe).

### NLW-6 — 24h raw-script input-log backstop
**Why:** no recoverable copy of the raw script existed.
**Acceptance criteria**
- The generate/enhance step logs the raw script once, tagged with the trace ID.
- Confirmed: no log drain persists it beyond Vercel's ~24h (or, if a drain exists, the script field is redacted at the drain).
- Logged exactly once per generation (no duplication across retries).

---

## 11. Open items
- [ ] Confirm Vercel **Settings → Log Drains** is empty (for NLW-6).
- [ ] Assign owners + sequence tickets.
- [ ] Schedule the **child-profiles** follow-up design (Phase 1/J).
- [ ] Evaluate **PITR + retention** as a backstop (P2).
- [ ] Decide deliberate **storage lifecycle** for generated images (they were our accidental savior; 407 temp folders are piling up).
