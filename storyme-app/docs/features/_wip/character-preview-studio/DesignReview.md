# Character Preview Studio — Design Review (WIP, awaiting approval)

Status: **Draft for review.** No code written yet.
Last updated: 2026-06-24

## 1. Goal

Replace the current fixed "2D Classic / 3D Pixar" character-preview UI with a single,
kid-friendly **generate → refine → compare → pick** studio, consistent with the
chapter-book "Create New" image flow (`MediaPanel` GenerateTab).

### Confirmed requirements (from product)
1. **Art-style picker** (replaces the two fixed boxes), default **2D Classic**:
   - 2D Classic (`classic`), 3D Pixar (`pixar`), Ghibli (`ghibli`), **Coloring/Sketch** (`coloring`), Realistic (`realistic`).
   - **RESOLVED:** Coloring/Sketch is just a normal 5th style — same generate → refine → compare → pick
     UX as 2D/3D, producing a single line-art-style preview image. **No step-by-step tutorial.**
     It goes through the same `generate-character-preview` path as every other style (NOT the
     sketch-guide tutorial endpoint).
2. **Model picker** — now **visible to everyone** (drop the `(admin)` gating), default **Gemini / Nano Banana 2**.
3. **Flow**: pick style → **Generate** (first one free) → preview in the "original" slot →
   **Refine** (small delta text box, image-to-image edit) or **Regenerate** (after editing the
   description) → **old-left / new-right** compare → kid **picks either** to save.
4. **Counter**: **6 attempts per character modal session**, shared across **edits AND regenerates**.
   The **first Generate is free**; everything after decrements. No reset within the session.
   At 0, the kid can still pick from existing versions but can't generate more.
5. **Save**: the single chosen image → `animatedPreviewUrl` (+ its chosen style).

## 2. Key finding: the preview UI is duplicated in 3 places

| Path | File | Notes |
|------|------|-------|
| A — Story builder modal | `src/components/story/CharacterFormModal.tsx` (~1496 lines) | `previewOptions {pixar, classic}`, sketch-guide, admin model picker |
| B — Characters page (inline modal) | `src/app/(dashboard)/characters/page.tsx` (~2487 lines) | ~90% identical to A; saves via Supabase direct |
| B2 — New character page | `src/app/(dashboard)/characters/new/page.tsx` (~1185 lines) | separate `pixarPreviewUrl`/`classicPreviewUrl` state; saves via `POST /api/characters` |

The generate/refine/compare/counter logic is **complex**; triplicating it (and keeping three
copies in sync) is exactly the duplication that has already produced bugs in this area.

**Recommendation (Principles 4 & 5 — Reusable Components / Reuse Before Rebuild):**
Build ONE shared component, `<CharacterPreviewStudio>`, and have all live paths render it.
This implements the feature once and removes the triplication.

> **RESOLVED Q1 — paths in scope.** Two live paths: **A** (story builder "+ Add Character" in
> `/create`) and **B** (`/characters` "+ New Character" inline modal, via `handleOpenForm`, also
> used for Edit). **B2** (`/characters/new`) has no user-facing entry — only the admin training
> page links to it as a demo. Plan: wire the shared component into A + B, and also into B2 (nearly
> free once the component exists) so the admin demo doesn't rot and zero duplication remains.

## 3. Proposed architecture

### 3.1 New shared component — `src/components/character/CharacterPreviewStudio.tsx`
Self-contained, presentation + flow. Props (callback-driven so each path keeps its own
save/auth):

```ts
interface CharacterPreviewStudioProps {
  // Inputs used to build the FIRST generation (and regenerations):
  characterInput: {
    name: string;
    mode: 'photo' | 'description';
    referenceImageUrl?: string;
    characterType?: string;
    subjectType?: SubjectType;
    medium?: ImageMedium;
    description: { hairColor?; skinTone?; clothing?; age?; otherFeatures? };
  };
  // Called when the kid commits a chosen preview:
  onPick: (result: { url: string; style: ArtStyleType }) => void;
  // Optional initial value (editing an existing character):
  initialPreviewUrl?: string;
  initialStyle?: ArtStyleType;
}
```

Internal state (mirrors the proven MediaPanel two-slot pattern):
```ts
const [style, setStyle]       = useState<ArtStyleType>('classic'); // default 2D
const [provider, setProvider] = useState<ImageProvider>('gemini-3.1'); // default Gemini
const [slotA, setSlotA]       = useState<PreviewResult | null>(null); // "original" (left)
const [slotB, setSlotB]       = useState<PreviewResult | null>(null); // "updated" (right)
const [editingFrom, setEditingFrom] = useState<'A'|'B'>('A');
const [editPrompt, setEditPrompt]   = useState('');
const [attemptsLeft, setAttemptsLeft] = useState(6); // first generate free; edits+regens decrement
```

UI blocks:
- **Style picker** (5 options from `ART_STYLE_OPTIONS`, default 2D Classic).
- **Model picker** (`VISIBLE_IMAGE_PROVIDER_OPTIONS`, default Nano Banana 2; no admin gate).
- **Generate** button (first call free).
- **Preview / compare area — rolling 2-up (RESOLVED, R3):**
  - First generate shows a **single** image (the current one).
  - Each new generate/edit: current image slides to the **left (older)**; new result appears on the
    **right (newer)**. Fixed spatial rule: old ← , new → (no alternating A/B).
  - Tap either to **select the keeper** (highlighted). The next refine builds on the **selected**
    one (default = newest/right); its result again lands on the right, prior selected slides left.
  - Only the **latest two** versions are ever compared (intentional simplification for kids).
  - "Use this" saves the selected version.
- **Refine** delta box ("Tell me what to change") — only visible once a preview exists;
  disabled when `attemptsLeft === 0`.
- **Counter chip**: e.g. "6 changes left" → decrements on each edit/regenerate.
- Gentle hint when `attemptsLeft <= 1`: "Not quite right? Change the description above and generate again."

### 3.2 Endpoint strategy (reuse existing infra)

Two operations, two existing endpoints (both extended slightly):

**(a) Initial generate + Regenerate-from-description → `POST /api/generate-character-preview`**
- Extend `style` to accept all 5: `'pixar' | 'classic' | 'ghibli' | 'realistic' | 'coloring'`.
- Wire `ghibli`/`realistic`/`coloring` into the preview generators (the style fragments already
  exist in `gemini-image-client.ts` for the scene path — thread the style into
  `generateCharacterPreviewClassic` / `generateNonHumanPreviewClassic` /
  `generateDescriptionOnlyPreviewClassic`; coloring uses the existing B&W line-art fragment /
  `generateImageWithGeminiColoring`).
- **Coloring/Sketch is a normal style here** — same code path as the others, returns a single
  preview image, no tutorial steps. (The separate `sketch-guide` tutorial endpoint is NOT used.)
- Generate **single style** (the picked one), not both — keeps it fast and matches the new UX.

**(b) Refine (delta edit, image-to-image) → `POST /api/v1/editor/generate-image`**
- Already supports `previousImageUrl` + `imageProvider` + `artStyle` and routes to an
  edit-capable model (GPT-image-2 / Gemini).
- Extend its `ART_STYLES` map to add `ghibli` + `realistic` (fragments come from `art-styles-config.ts`).
- Send `{ previousImageUrl: source.url, prompt: editPrompt, artStyle: style, imageProvider: provider }`.

> Why split: generate-character-preview owns character-specific logic (subject-type detection,
> medium/faithfulness prompts, description-only mode); the editor endpoint owns image-to-image
> edits. Reusing both avoids rebuilding either.

### 3.3 Counter semantics (single source of truth = the component)
- `attemptsLeft` starts at 6, lives in the component for the modal's lifetime.
- First successful **Generate**: no decrement.
- Each subsequent **Generate (regenerate)** and each **Refine (edit)**: −1.
- Failed generations (error) do **not** decrement (kid shouldn't be punished for a server error).
- Reset only when the modal/studio unmounts (new character session).
- This is a **client-side UX budget**, not a security control — see Principle 1 note.

### 3.4 Save behavior
- `onPick` returns `{ url, style }`. Each path's existing save code:
  - uploads the chosen image to storage if it's a `data:` URL (reuse `uploadPreviewToStorage` /
    the `uploadPreviewDataUrl` helper already added), then
  - persists `animated_preview_url = <storage url>`.
- Single preview per character (drops the dual classic+pixar save).

> **RESOLVED Q2 — Coloring/Sketch.** Treated as a normal style: save the chosen image as
> `animated_preview_url`, no tutorial steps, no `sketchImageUrl` involvement.

> **RESOLVED Q3 — image only.** Do NOT persist the chosen art style on the character row; the
> saved image is enough (scene generation uses its own `illustrationStyle`). No new DB column.

## 4. Design-principles check (CLAUDE.md, mandatory)

- **1. Security by Default** — Endpoints require auth; no change there. BUT the 6-attempt cap is
  **client-side UX only**, and (per R1) these endpoints do **NOT** currently enforce
  `checkImageGenerationLimit` — so there is no real cost ceiling today. Making the model picker
  public (incl. pricier GPT) without adding that enforcement is a cost risk. **Action: add
  `checkImageGenerationLimit` to both endpoints (see R1).** No secret leakage from the picker itself.
- **2. Clear API Contracts** — Extend existing Zod schemas: add `ghibli`/`realistic`/`coloring`
  to `generate-character-preview` `style`, add `ghibli`/`realistic` to editor `ART_STYLES`.
  Versioned editor route stays `/api/v1/...`. No breaking changes to existing callers (additive).
- **3. Scalable DB Schema** — No schema change expected (save to existing `animated_preview_url`).
  Only if OPEN Q3 = "persist style" would we add a nullable column (migration).
- **4. Reusable Components** — Core of the plan: one `<CharacterPreviewStudio>` replaces 3 copies.
- **5. Reuse Before Rebuild** — Reuses `generate-character-preview`, `editor/generate-image`,
  `sketch-guide`, `art-styles-config`, `VISIBLE_IMAGE_PROVIDER_OPTIONS`, existing upload helpers,
  and the proven slotA/slotB pattern. No new image infra.
- **6. Separation of Concerns** — Component handles UI/flow; endpoints handle generation; each
  path keeps its own save/auth via the `onPick` callback. No business logic added to UI beyond
  the attempts counter.
- **7. Stateless Services** — No server state added; attempts counter is client-side. Endpoints
  stay stateless.
- **8. Responsive & Accessible** — Pickers as real `<select>`s with labels; compare cards
  keyboard-selectable with `aria-pressed`; counter announced via `aria-live`; touch targets ≥44px;
  edit box labeled.

## 4.5 Risks & mitigations (from plan review)

- **R1 (RED, DECISION NEEDED) — no server-side cost cap.** Neither `generate-character-preview`
  (only `logApiUsage`) nor `editor/generate-image` (nothing) calls `checkImageGenerationLimit`.
  The 6-counter is client-side and is **reset by the "start over with a new modal" path**, so
  there is effectively NO ceiling — unlimited generations, now incl. the pricier public GPT model.
  **Mitigation: add `checkImageGenerationLimit` to both endpoints. Recommend MUST-DO this work.**
- **R2 (RESOLVED) — 6 shared budget is fine.** Kids don't need 6 per style; worst case they start
  over with a new modal.
- **R3 (RESOLVED) — rolling 2-up, older-left/newer-right** (see §3.1).
- **R4 (SCOPE) — 5 styles not yet in the preview path.** `styleVariant` exists only on the SCENE
  generator; preview fns (`generateCharacterPreviewClassic` etc.) take no style. Must thread style
  through human / non-human / description-only generators + their OpenAI siblings + prompt builders.
  Budget real time; test all 5 styles × {human, non-human, description-only} × {photo, description}.
- **R6 (TEST) — likeness drift.** Generate (character-faithful prompts) vs Refine (generic editor
  edit) are different engines; add a test that refine keeps the character on-model.
- **R7 (UX, OPTIONAL) — visual style cards vs dropdown.** Tappable style thumbnails read better for
  ages 5–8 than a `<select>`; consider cards for the style picker.

## 5. Work breakdown (estimate)

1. Extend `generate-character-preview` to accept 5 styles + single-style; wire ghibli/realistic
   into preview generators; route coloring → sketch-guide. (endpoint + lib)
2. Extend editor `ART_STYLES` with ghibli/realistic. (small)
3. Build `<CharacterPreviewStudio>` (picker + generate + refine + compare + counter). (bulk)
4. Wire Path A (CharacterFormModal) to use it; remove its old preview block + dup state.
5. Wire Path B (Characters page inline modal) to the shared component. **[Primary]**
   - B2 (`/characters/new`, admin demo) — **optional/stretch**: migrate only if cheap once A+B done.
6. Remove `(admin)` gating on the model picker.
7. Manual test matrix (below) on localhost; then review #2; then ship.

## 6. Test matrix (localhost before ship)
- Each of 5 styles generates a preview (photo mode + description mode).
- Coloring/Sketch matches the "teach me how to draw" output.
- Refine edits the image (keeps likeness) and lands old-left / new-right; pick either works.
- Regenerate after editing description produces a fresh base and decrements counter.
- Counter: first free; 6 edits/regens then blocked; failures don't decrement.
- Model picker visible to non-admin; default Gemini.
- Chosen preview saves as a storage URL (not base64) in all live paths.
- Save persists; appears on Characters page / story builder.

## 7. Open questions — all resolved
- **Q1 ✅** Live paths: A (story builder) + B (`/characters` inline modal). B2 (`/characters/new`)
  is admin-demo only; also migrate it to the shared component.
- **Q2 ✅** Coloring/Sketch = normal style, single image, no tutorial; save as `animated_preview_url`.
- **Q3 ✅** Image only; no chosen-style column.
