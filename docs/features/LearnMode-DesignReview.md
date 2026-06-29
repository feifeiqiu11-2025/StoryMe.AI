# Learn Mode (Factual / Educational Books) — Design Review

**Status:** Design review — awaiting approval before implementation
**Author:** Drafted with Claude (design review per CLAUDE.md mandatory workflow)
**Last updated:** 2026-06-15

---

## 1. Goal & Scope

Support teachers (and parents) creating **fact-based, real-world educational books** — e.g. the life cycle of a butterfly, the life cycle of a bee, how a baby grows before birth, Chinese paper making (why / who / when / how / impact).

**Critical framing decision (locked):**
- We do **NOT** build a grid/storyboard/infographic layout. We keep the existing **picture-book experience**: 1 image per page/scene, text alongside, same reader / narration / quiz / PDF export.
- The example images shared during brainstorming defined the **content domain** (factual, real-world), **not** the desired format.
- Two things change vs. a normal story: (a) the **content stays factual & on-topic** (the "storyline" is the real sequence, e.g. the 4 phases of a butterfly — no fiction, no drift), and (b) the **visuals can be realistic / real-world**, via controlled AI generation.

**This is NOT a new module, NOT a new dashboard tile, NOT a separate "mode."** It is delivered as a **combination of existing axes**:

> **Existing template (Knowledge & World Exploration) + a new Realistic art style + character-optional entity consistency.**

This keeps it aligned with how every other template already works (no flow fork), and reuses ~80% of the existing engine.

---

## 2. Key Decisions (locked during brainstorm)

| # | Decision |
|---|---|
| D1 | Keep picture-book format (1 image/page). No grid/infographic layout. |
| D2 | Images via **controlled AI generation** (not stock photos / not uploads). |
| D3 | Delivered as **K&W template + new Realistic art style**, not a separate mode/module/tile. |
| D4 | **Art style and content are decoupled axes** — any template × any art style. K&W *defaults* to Realistic but the user can override (2D/Ghibli/etc.). |
| D5 | **Character is optional.** A factual book can have zero characters (pure subject/setting). Users may still add a character if they want. |
| D6 | Consistency is **entity-centric** (setting, optional character, transforming subject), reusing the existing **Story Bible**. Not character-gated. |
| D7 | **Real-world scale & anatomy accuracy** (ant ≠ fox-sized; caterpillar without big cartoon eyes) is **scoped to the Realistic style only** — never global (stylized/anthropomorphic stories intentionally break scale). |
| D8 | Do **not** touch existing cartoon style lines (the "big eyes" wording) — out of scope, avoids re-validating every existing story. |
| D9 | Facts come from **AI knowledge + guardrails** (+ optional verification later). |
| D10 | Optional **guide character** allowed (the child as narrator/observer). Mixing a cartoon library character into a realistic world is permitted — it's the user's intent. |
| D11 | **Caption voice** improvement ("less AI") via splitting *facts* from *voice* + mentor-text examples — Phase 2, benefits all templates. |
| D12 | **Anchor images generate with the batch by default** (no upfront cost). An **opt-in "Preview / lock references"** lets the user check anchors first. |
| D13 | On-demand preview generates the **exact** anchor the batch will use, **caches it, and the batch reuses it** — preview never adds cost. |
| D14 | Remove the **eager step-3.5 location-reference generation** (which hardcodes a "whimsical" style) — fold anchor generation into the batch so the style is always correct. |
| D15 | Anchor images **count against the user's image quota** (simple; usually quota-neutral since previewing avoids bad batches). |
| D16 | Regenerating an anchor does **not** auto-regenerate scenes. Affected scenes get a precise **"references changed — regenerate?"** badge (cheap: Bible already links scene→anchor). |
| D17 | Style is a **single source of truth** (the book's selected art style); **no silent cartoon fallback** in anchor generation (fail loud). |
| D18 | **Move the art-style picker into the Story Settings step** (UX: it belongs with reading level/tone). Functionally safe because anchors now generate late. |
| D19 | **New auto-generated anchors always follow the book's style;** library characters keep their own image. |
| D20 | New characters become anchors only if **recurring (≥2 scenes)** — one-off background people do not. |
| D21 | "Save new character to library" — **v1 if easy** (reuse `characters/save-scene` pattern), else fast-follow. |

---

## 3. Regression Found (fix included)

**Symptom (user-reported):** detecting a character that isn't in the library "sometimes doesn't work," and no image is generated for it.

**Root cause:** Two enhancement paths exist:
- **Legacy** (`buildEnhancementPrompt`, `scene-enhancer.ts:~222-272,470`): *allowed* new characters (labeled `(NEW)`, flagged `isNewCharacter`). This is the behavior the user remembers.
- **Story Bible** (`buildStoryBiblePrompt`, `scene-enhancer.ts:~616`): *forbids* new characters — "Only reference character names from the provided list." This rule was added intentionally to stop **location** hallucination.

The Story Bible became the **default for all English stories** in commit `91bf7f1` (`create/page.tsx:~749` → `enableStoryBible: contentLanguage === 'en'`), which silently disabled new-character detection.

**Also confirmed:** there is **no reference-image generator for characters** (locations have `api/locations/generate-references`; characters have no equivalent).

**Fix (surgical, does not reintroduce the location bug):** In `buildStoryBiblePrompt`, split the single "use only the provided list" constraint into two:
- **Locations** → stay locked to detected clusters (keep anti-hallucination rule verbatim).
- **Characters** → allow the model to surface a *recurring* new character → emit `{temp_id, name, description, first_scene_index}`, mirroring the location structure. Add `new_characters[]` to `StoryBibleResult`. Gate on recurrence (D20).

---

## 4. What's Reused vs. New

**Reused (do not rebuild):**
- Story Bible: location clustering, locked 25–40 word descriptions, pronoun resolution, scene→entity linking (`scene-enhancer.ts`, `enhance-scenes/route.ts`).
- Location reference image generation pattern (`locations/generate-references`).
- Entity model: `character_library.subject_type` + `role` (character vs scene_element).
- Dual conditioning (locked-description prose + reference images) in `generate-images/route.ts:~281-338`.
- Zero-character scene rendering (already supported in the Bible path).
- Short prompt → expanded script (`highly_expanded` expansion level).
- K&W template + Educational tone (`story-templates.ts`).
- `characters/save-scene` pattern for saving an entity to the library.

**New / changed:**
1. Surgical Bible split to re-allow recurring new characters (Section 3).
2. New `api/characters/generate-references` route (mirror locations).
3. Realistic art style + scale/anatomy guidance (scoped to that style).
4. K&W factual guardrails (template-local prompt).
5. Character-optional (relax 3 validation checks).
6. Remove eager step-3.5 anchor generation; anchors generate at batch / on-demand, in the selected style.
7. Opt-in "Preview / lock references" UI + caching/reuse + precise stale badges.
8. Move art-style picker to Story Settings step.
9. Caption voice rework (Phase 2).
10. (Optional, Phase 3) per-image accuracy verification pass.

---

## 5. Design Review Against the 8 Principles

**1. Security by Default** — New `characters/generate-references` route reuses existing auth + Supabase Storage signing; no new exposure. Inputs (style enum, anchor descriptions) validated with Zod. Synthetic children are generated (no real-child likeness/PII).

**2. Clear API Contracts** — Add `new_characters[]` to `StoryBibleResult` (typed). New route mirrors the location route's request/response shape. Style passed as an explicit enum value (no implicit default); missing style fails loud.

**3. Scalable Database Schema** — No new tables required. Anchor URLs persist on the Bible objects (`locations[].reference_image_url`, new `new_characters[].reference_image_url`) plus the `style` they were generated with (for staleness). Reuses `subject_type` / `role`. Saving a new character to library reuses existing character_library schema.

**4. Reusable Components** — Realistic is a new style entry alongside existing styles. References strip + anchor modal are generic (work for any auto-generated anchor, not just factual books). Stale badge is generic.

**5. Reuse Before Rebuild** — Character reference generator is a near-copy of the location generator. Consistency, conditioning, expansion, templates all reused. No new subsystem.

**6. Separation of Concerns** — Generation stays in routes/services; UI only previews/approves/regenerates. Bible prompt change is in the AI layer; quota check stays in the existing limits layer.

**7. Prefer Stateless Services** — Anchors persist in Bible/Storage, not memory. Anchor generation is lazy (batch/on-demand), cached by `(description + style)`; regeneration only on real input change. Back-and-forth navigation triggers no generation.

**8. Responsive & Accessible UI** — References strip and modal follow existing component patterns (44px touch targets, keyboard nav, ARIA labels, `aria-live` for generation status). Stale badge uses `role="status"`.

---

## 6. File-Level Change List

**AI / prompts**
- `src/lib/ai/scene-enhancer.ts` — split location vs character constraint in `buildStoryBiblePrompt` (~616); add `new_characters[]` to `StoryBibleResult` (~528) + parser; recurrence gate (D20).
- `src/lib/ai/story-templates.ts` — add factual/on-topic guardrails to Knowledge & World Exploration.

**Image generation**
- **NEW** `src/lib/art-styles-config.ts` — single source of truth for art styles (type, label, description, per-provider prompt strings). Replaces type defined 5× and prompt strings duplicated across providers. See Phase 1 Step 0.
- `src/lib/openai-image-client.ts` — consume the registry for `SCENE_STYLE_LINES`; add `'realistic'` entry (clean).
- `src/lib/gemini-image-client.ts` — consume the registry for the STYLE *fragment*; for Realistic, add a **dedicated branch/function**. **Important nuance:** the existing "NOT a photograph / no photo realism" rule serves TWO purposes — (1) cartoon aesthetic, and (2) a *safety guard* added because Gemini historically sometimes returned an actual real internet/stock photo as the scene (real people, copyrighted, inconsistent with generated characters — bad for a kids' book). The Realistic branch must **relax #1 but KEEP #2**: instruct "generate a realistic, detailed, photorealistic *illustration* with natural proportions — do NOT output/retrieve/copy an actual photograph or real internet image, no real identifiable people." Add scale + anatomy guidance scoped to Realistic only. Do NOT alter existing cartoon lines. Keep existing benign "big = large not fat" line. (Verify whether the old real-photo quirk still occurs during testing.)
- `src/app/api/locations/generate-references/route.ts` — remove hardcoded style (line ~76); accept explicit style; (called at batch/on-demand instead of eagerly).
- **NEW** `src/app/api/characters/generate-references/route.ts` — generate a clean character anchor in the selected style; upload to Storage; return `reference_image_url`.
- `src/app/api/generate-images/route.ts` — wire `new_characters[]` references into conditioning (reuse existing path ~281-338); generate any missing anchors at batch start, in the selected style; clean up legacy `ART_STYLE` constant (~47) vs `illustrationStyle` duplication.

**Validation (character-optional)**
- `src/app/api/enhance-scenes/route.ts` (~77), `src/app/api/generate-images/route.ts` (~106), `src/app/api/projects/save/route.ts` (~141) — relax "≥1 character required" to "≥1 entity present somewhere"; keep existing behavior for character-based stories.

**Create flow / UI**
- `src/app/(dashboard)/create/page.tsx` — remove eager `generate-references` call (~794); move anchor generation into batch/on-demand; pass selected style through; move art-style state usage into Settings step; fix `ART_STYLE`/`illustrationStyle` duplication (~2040/2042).
- `src/components/story/StorySettingsPanel.tsx` — host the art-style picker.
- `src/components/story/ScenePreviewApproval.tsx` — remove art-style picker (moved); add opt-in "Preview / lock references" strip + anchor modal (preview / regenerate / edit prompt / optionally save-to-library); precise "references changed — regenerate?" badge on affected scenes.
- `src/components/story/StyleSelector.tsx` — add Realistic option.

**Quota**
- Existing image-limit layer (`images_limit` source of truth) — ensure anchor generations are counted (D15).

---

## 7. Phasing

**Phase 1 — Step 0 (prerequisite refactor, do first):**
- **Art-style registry consolidation.** Today art styles have no single source of truth (type defined 5×; prompt strings duplicated across Gemini/OpenAI/Fal; 2 picker UIs; per-style Gemini functions). Adding a style naively = ~15–18 edit sites. Create `src/lib/art-styles-config.ts` (type + label + description + per-provider STYLE fragments — all verbatim/behavior-preserving); have pickers and provider prompt lookups consume it. Drops "edits per new style" to ~1 **for the parts that are clean** (type, picker, OpenAI `SCENE_STYLE_LINES`). **Defer** collapsing the per-style Gemini *functions* (Tier 2 — bigger/riskier). The D18 picker move to Settings already removes the duplicate inline picker in `ScenePreviewApproval`. Also fixes the latent `regenerate-scene/route.ts` missing-`coloring` bug.
  - **Correction (found while reading source):** Gemini is NOT a clean lookup. Its `STYLE:` line is embedded in structurally different per-style functions, and the Pixar/Classic templates hardcode anti-realism rules ("Generate a DIGITAL ILLUSTRATION, NOT a photograph", "no photo realism" — `gemini-image-client.ts:659,880`). So the registry centralizes the Gemini STYLE *fragment* only; the base templates stay in the client. **Realistic therefore needs its own Gemini branch/function that omits those anti-photoreal rules — it does NOT ride the parameterized path for free.**

**Phase 1 (MVP — a working factual realistic book):**
- Realistic art style + scoped scale/anatomy. OpenAI side = one registry entry; **Gemini side needs a dedicated realistic branch** that drops the "NOT a photograph / no photo realism" rules and adds scale/anatomy guidance (scoped to Realistic only).
- K&W factual guardrails.
- Character-optional (relax checks).
- Surgical Bible split (re-allow recurring new characters) — fixes the regression.
- New character-reference route.
- Remove eager anchor generation → batch-time anchor flow, style-correct.
- Move art-style picker to Settings.
- Opt-in preview + caching/reuse + precise stale badge.
- Quota accounting for anchors.
- (If easy) save new character to library.

**Phase 2:**
- Caption voice rework (split facts from voice + mentor texts) — benefits all templates.

**Phase 3 (only if trust bar is "teacher-trustworthy, no wrong details"):**
- Per-image accuracy verification pass + regenerate-on-fail.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Surgical Bible split reintroduces location hallucination | Keep the location rule verbatim; only *add* the character clause; test on an existing multi-location story. |
| Bad auto-generated anchor poisons the whole batch | Opt-in preview (default off, surfaced more for new characters which are higher-variance). |
| Back-and-forth navigation wastes quota | Lazy generation (batch/on-demand only) + cache by `(description + style)`; settings churn triggers nothing. |
| Realistic book gets cartoon background/character | Single source of truth for style + no silent fallback (fail loud) + auto anchors always follow book style. Removing eager generation fixes the timing root cause. |
| Realism raises the accuracy bar (wrong details more glaring) | Facts/voice split (Phase 2) + optional verification (Phase 3); scene prompts must encode real visual facts. |
| Anchor edited after batch → inconsistent scenes | Precise stale badge; user regenerates explicitly (no silent auto-regeneration). |

---

## 9. Open Items for Final Sign-off

1. Trust bar — confirm Phase 1–2 ("good enough to learn from") is acceptable for launch, with Phase 3 verification deferred.
2. Confirm "save new character to library" target (v1 vs fast-follow).
3. Confirm Phase 1 scope is the right first cut (caption voice intentionally Phase 2).
