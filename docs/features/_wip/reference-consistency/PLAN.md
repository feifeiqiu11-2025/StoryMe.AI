# Plan: Reference-image consistency — batch + edit parity

Status: **awaiting approval** (no code yet). Owner: image-gen. Created 2026-06-29.

Follow-up to PR #3 (`fix/reference-image-authoritative`, merged to main 2026-06-29), which made the
reference image authoritative for the **human** bucket in **batch** scene generation. Review surfaced
gaps; this plan closes them.

## Problem / gaps found

1. **Red flag (perf):** `MultiImageEditError` is thrown inside `callOpenAIImage`'s inner multi-image
   catch, but the **outer retry loop doesn't treat it as non-retryable** → it re-runs the same failing
   multi-image edit up to 3× before surfacing and triggering the Gemini fallback. The fallback still
   works, just after ~3× wasted slow calls.
2. **Creature/animal section unfixed:** non-human characters (e.g. "Nerdy", a kid's drawing of a
   candy/snake creature) go through the animal section, which still appends
   `(cute animated animal, animal face, NO human features)`. That forces a **generic** animal and lets
   the drawing's actual shape morph scene-to-scene. PR #3 only fixed the human bucket.
3. **Edit path has no parity:** `openaiEditScene` / `editImageWithGemini` attach references but with
   weak wording (no authoritative rule, no "Image N IS &lt;Name&gt;" binding), and **Gemini edit caps refs
   at 3** vs **8 in batch**. Inconsistent batch-vs-edit behavior is confusing.

Principle: **respect the child's drawing** — faithfully translate it into the chosen art style
(3D/2D/etc.) preserving its shape/colors/features; never redesign it into a generic creature.

## Goals

- Reference image authoritative + faithful for **all** subject types (human AND creature/animal).
- **Batch and edit behave the same**: same authoritative rule, same per-reference binding, same ref cap,
  on **both** providers (Gemini + OpenAI).
- Fix the retry red flag.

## Scope (in)

### A. Red-flag fix — short-circuit `MultiImageEditError`
- `src/lib/openai-image-client.ts`, outer `catch (error)` (~L257): add at top
  `if (error instanceof MultiImageEditError) throw error;`
- Rationale: retrying an identical multi-image edit can't succeed; surface immediately so the route's
  Gemini fallback runs without 3× latency. (Same spirit as the existing 429 bubble.)

### B. Creature/animal section — authoritative + preserve-shape (Gemini batch, 3 builders)
- Add a shared helper `buildCreatureSection(animalCharacters, noRefDescriptor)` (sibling of
  `buildNamedCharacterSection`):
  - Creature **with** a reference:
    `- &lt;Name&gt;: render THIS creature exactly as shown in its reference image — preserve its distinctive
    shape, colors, and features; translate faithfully into the story's art style; do NOT replace it with
    a generic or realistic animal. &lt;prompt&gt;`
  - Creature **without** a reference: keep the existing per-builder descriptor (`noRefDescriptor`) — e.g.
    `cute animated animal…` (pixar), realistic ternary (classic), `cute cartoon animal in line art`
    (coloring) — since there's no image to preserve.
- Apply in all 3 builders: base (~L663), classic (~L879, keep `isRealistic` path), coloring (~L1068).
- The global `STYLE:` line still controls the look, so the per-line wording stays style-agnostic for
  referenced creatures.

### C. Edit path parity (both providers)
- **C1. `editImageWithGemini`** (`gemini-image-client.ts` ~L3001 & ~L3057):
  - Raise cap `slice(0, 3)` → `slice(0, MAX_REFERENCE_IMAGES_PER_SCENE)` in **both** spots (text list +
    image inlining).
  - Inject `REFERENCE_AUTHORITATIVE_RULE`; upgrade `Characters MUST match their attached reference images`
    to the authoritative rule wording.
- **C2. `openaiEditScene`** (`openai-image-client.ts` ~L834):
  - Replace passive "keep these subjects faithful" with `REFERENCE_AUTHORITATIVE_RULE` +
    `buildReferenceBindingLine`. **Offset note:** the current image being edited is Image 1, references
    are Images 2..N → use `buildReferenceBindingLine(i + 1, label)` so it reads "Image 2 IS &lt;Name&gt;".
  - Set `multiImageFailureMode: fetched.length > 0 ? 'throw' : 'fallback-single'`. The edit-image route
    already falls back to `editImageWithGemini` on any OpenAI error (route L159-180), so a multi-ref
    failure routes to Gemini edit (which keeps all refs) instead of silently editing with no references.
- **C3. Cap alignment:** Gemini edit now uses `MAX_REFERENCE_IMAGES_PER_SCENE` (8) = batch. OpenAI batch
  and edit both send all refs (no artificial cap). Result: batch and edit are consistent.

## Out of scope (separate follow-ups)

- **D. Preview-anchor pipeline:** drawing-based characters (Nerdy) get a raw cleaned drawing as their
  `animated_preview` instead of a rendered storybook character (Rainbow has one). This is the upstream
  root of cross-scene drift and a bigger change — separate plan.
- subject_type classifier / `'unknown'` enum — still parked.

## Principle compliance (CLAUDE.md)
- #4/#6 Reusable/Separation: shared `buildCreatureSection`, shared cap constant, shared
  `REFERENCE_AUTHORITATIVE_RULE`/binding across batch + edit — reduces the per-provider divergence.
- #2 API contract: edit response unchanged; batch `referenceNotices` already added in PR #3.
- #1/#7 Security/Stateless: no new surface.

## Risks
- **B** changes creature wording for **every** creature story, not just Nerdy. Net-positive (more
  faithful) but broad — validate against a couple of existing creature stories that already looked fine.
- **C2 binding offset** must map references to Image 2..N (current image = Image 1) or labels misalign.
- **C1** raising 3→8 inlines more images per Gemini edit → larger/slower requests, but matches batch.
- **A** is safe: `MultiImageEditError` retry can't succeed anyway.

## Validation
- `tsc --noEmit` clean (no new errors); dev server compiles + loads the routes.
- Regenerate the "Fairy Crystal" / Nerdy story on **both** providers (Gemini + OpenAI batch) → check
  Nerdy is faithful to its drawing and consistent across scenes.
- Run an edit on a scene with **>3** character refs → confirm all are honored (not capped at 3); force an
  OpenAI multi-ref edit failure → confirm it routes to Gemini edit (refs kept), not a no-ref edit.
- Confirm sticker/preview/single-ref callers unaffected.

## Rollout
- One branch off `main`, validate on localhost, **hold for explicit push authorization** (no auto-push).
