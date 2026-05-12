# Mobile API spec — chapter books + unified story shape

**Audience:** KindleWood Kids native mobile app team.
**Owner:** Web team (kindlewoodstudio.ai).
**Last updated:** 2026-05-11.

---

## Why this exists

The kids app currently consumes `/api/stories/public/[id]` with a picture-book-shaped response (`scenes[]`, audio fetched separately). Chapter books were added to the web product and have a different content shape (`pages[]` — flowing text + inline images). To stop forcing mobile to maintain two parallel renderers, the detail endpoint now returns a **unified shape** that works for both project types, with audio embedded inline.

The old `scenes[]` field is still populated for back-compat — existing mobile builds keep working. New mobile builds should read the unified fields.

## Endpoints at a glance

| URL | Method | Purpose | Anonymous? |
|---|---|---|---|
| `GET /api/stories/public` | GET | List feed (search / sort / filter / pagination) — **unchanged** | Yes |
| `GET /api/stories/public?chapterStoriesOnly=true&limit=6&offset=0` | GET | New: just chapter stories (real `chapter_book` + tagged picture books) | Yes |
| `GET /api/stories/public?featuredOnly=true&limit=24` | GET | Featured carousel — unchanged | Yes |
| `GET /api/stories/public/[id]` | GET | Story detail — **now returns unified shape** | Yes (public + unlisted-with-token) |
| `POST /api/projects/[id]/publish-kids-app` | POST | Parent publishes a story to specific kid profiles — **now supports chapter books** | Owner only |

List endpoints (`/api/stories/public`) return a shallow per-story shape: `id, projectType, title, coverImageUrl, authorName, authorAge, viewCount, publishedAt, tags`, etc. Mobile decides which stories to show; tapping into one calls the detail endpoint.

## Story detail response — the unified shape

`GET /api/stories/public/[id]` (with optional `?token=<share_token>` for unlisted) returns:

```jsonc
{
  "success": true,
  "story": {
    // ── Identity + metadata ──────────────────────────────────────
    "id": "uuid",
    "projectType": "picture_book" | "chapter_book",
    "title": "string",
    "description": "string | null",
    "authorName": "string | null",
    "authorAge": "number | null",
    "readingLevel": "string | null",
    "storyTone": "string | null",
    "publishedAt": "ISO-8601",
    "createdAt": "ISO-8601",
    "viewCount": "number",
    "likeCount": "number",
    "shareCount": "number",
    "featured": "boolean",
    "visibility": "public" | "unlisted",
    "secondaryLanguage": "string | null",   // e.g. 'zh', 'ko', 'es', null

    // ── Cover ────────────────────────────────────────────────────
    "coverImageUrl": "string | null",       // thumbnail / splash image
    "coverAudio": AudioBlock | null,        // narration played on the cover splash

    // ── Unified page sequence (NEW — both project types) ─────────
    "pages": StoryPage[],

    // ── Optional quiz at the end ─────────────────────────────────
    "quiz": Quiz | null,

    // ── LEGACY (kept populated for older mobile builds) ──────────
    // New builds should ignore this and read `pages` instead.
    // Empty array for chapter_book projects.
    "scenes": LegacyScene[]
  }
}
```

### `StoryPage`

```ts
type StoryPage = {
  pageNumber: number;        // 1-indexed
  kind: 'scene' | 'page';    // 'scene' = picture-book scene; 'page' = chapter-book Tiptap page

  imageUrls: string[];       // primary illustration(s) on this page (0..N)
  plainText: string;         // always populated — used for TTS / search / accessibility

  // Rich content per kind:
  html?: string;             // chapter_book pages ONLY — sanitized HTML to render in WebView
  caption?: string | null;   // picture_book scenes ONLY — display caption
  captionSecondary?: string | null;  // picture_book secondary-language caption when project has secondaryLanguage

  audio: AudioBlock | null;  // narration for this page (null when not generated)
};
```

### `Quiz`

```ts
type Quiz = {
  questions: QuizQuestion[];        // ordered by question_order
  transitionAudio: AudioBlock | null;  // "Now let's see what you remember…" — played between story end and quiz
};

type QuizQuestion = {
  id: string;
  order: number;                    // 1-indexed
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correctAnswer: 'A' | 'B' | 'C' | 'D' | null;
  explanation: string | null;
  audio: AudioBlock | null;         // narration of the question + options
};
```

### `AudioBlock`

```ts
type AudioBlock = {
  url: string;                      // primary-language MP3 URL
  text: string | null;              // what's being narrated (for highlighting / captions)
  durationSeconds: number | null;   // null until/if we capture it
  urlSecondary: string | null;      // secondary-language MP3 URL (story.secondaryLanguage)
  textSecondary: string | null;     // secondary-language narration text
};
```

### `LegacyScene` (deprecated, do NOT use in new code)

```ts
type LegacyScene = {
  id: string;
  sceneNumber: number;
  imageUrl: string | null;
  caption: string | null;
  captionChinese?: string | null;   // legacy Chinese-specific field
  captionSecondary?: string | null;
  description?: string | null;
  prompt?: string | null;
};
```

Kept populated on picture books indefinitely for old mobile builds. New builds should iterate `pages[]` instead. After all installed users upgrade past the kids-app release that consumes `pages[]`, we can plan to drop `scenes[]` — but that's a coordinated change, not happening soon.

## Picture book vs chapter book — what's different per page

| Field | Picture book (`kind: 'scene'`) | Chapter book (`kind: 'page'`) |
|---|---|---|
| `pageNumber` | scene_number, 1-indexed | doc page index, 1-indexed |
| `imageUrls` | `[scene.image_url]` (always 1 item if present) | `[…]` (0..N images embedded in the page) |
| `plainText` | caption / description | extracted text from the Tiptap doc |
| `html` | absent | **present** — sanitized HTML to render in WebView |
| `caption` | display caption (kid-friendly) | absent |
| `captionSecondary` | secondary-language caption | absent (chapter-book translation = future work) |
| `audio.url` | scene narration MP3 | page narration MP3 — **null until audio ships for chapter books** |

## Recommended rendering — picture books

For each `page` where `kind === 'scene'`:

1. Show `imageUrls[0]` as the page illustration.
2. Show `caption` as the caption overlay or below the image. If `secondaryLanguage` is set AND the user has toggled to it, show `captionSecondary` instead.
3. If `page.audio` is present, show a play button. On tap, play `audio.url` (or `audio.urlSecondary` per language toggle). Highlight `audio.text` while playing if you want word-sync.
4. Swipe / arrow for next page.

This is the same flow you already have today.

## Recommended rendering — chapter books

For each `page` where `kind === 'page'`:

1. Render `page.html` in a WebView. Inject a stylesheet matching `chapter-book-prose` from the web reader (we host the same font files at `https://kindlewoodstudio.ai/fonts/Lora-*.ttf` etc; you can either reference those URLs or bundle the TTFs locally).
2. If `page.audio` is non-null: show a play button. Play `audio.url`. Audio button is **disabled / hidden** when null — kids read silently in that case.
3. Swipe / arrow for next page.

A minimal HTML wrapper for the WebView:

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
  <style>
    @font-face { font-family: 'Lora'; src: url('https://kindlewoodstudio.ai/fonts/Lora-Regular.ttf'); }
    @font-face { font-family: 'Lora'; font-weight: 700; src: url('https://kindlewoodstudio.ai/fonts/Lora-Bold.ttf'); }
    @font-face { font-family: 'Comic Neue'; src: url('https://kindlewoodstudio.ai/fonts/ComicNeue-Regular.ttf'); }
    /* + Lora-Italic, Lora-BoldItalic, ComicNeue-Bold, etc — see /fonts/ */

    body {
      font-family: 'Lora', Georgia, serif;
      font-size: 18px;
      line-height: 1.6;
      color: #1f2937;
      padding: 16px;
      margin: 0;
    }
    h1 { font-size: 1.75em; margin: 0.5em 0; }
    h2 { font-size: 1.4em; margin: 0.5em 0; }
    p { margin: 0.5em 0; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    img[data-align='left']  { float: left;  margin: 0.25em 1em 0.5em 0; }
    img[data-align='right'] { float: right; margin: 0.25em 0 0.5em 1em; }
    img[data-fullbleed='true'] {
      width: calc(100% + 32px); max-width: none;
      margin-left: -16px; margin-right: -16px;
    }
  </style>
</head>
<body>
  <!-- INSERT page.html HERE -->
</body>
</html>
```

## Cover handling

`story.coverImageUrl` is the **thumbnail / splash image** for the story, separate from `pages[]`.

Recommended cover flow:

1. Show `coverImageUrl` on a splash screen.
2. If `coverAudio` is non-null, play it.
3. Tap → enter `pages[]` reader at page 1.

For picture books, page 1 is scene 1 (which is NOT the cover). For chapter books, page 1 is whatever the kid wrote on page 1 of the doc (often a cover-styled page with title + author info). Mobile decides whether to show a separate cover splash always, or detect cover-like pages and skip the splash. We recommend **always show the splash** for consistency.

## View tracking — REQUIRED action on story open

`GET /api/stories/public/[id]` is CDN-cached (60 s) and **does NOT
increment view_count**. Mobile must explicitly POST to the same URL
once per actual story-open event:

```
POST /api/stories/public/[id]
Content-Type: application/json

{ "action": "view" }
```

The POST is uncached, always reaches the function, and increments
`projects.view_count` (only for stories where `visibility === 'public'`;
unlisted-via-token reads remain untracked by design).

Fire-and-forget — don't block the reader UI on this response. Failure
should be silently ignored.

The endpoint also accepts `{ "action": "share" }` for outbound-share
counting (existing behavior, unchanged).

## Quiz handling

If `story.quiz` is non-null:

1. After the last page, show a "Quiz time!" transition. If `quiz.transitionAudio` is present, play it.
2. Walk through `quiz.questions[]` one at a time.
3. For each question:
   - Display `question` text.
   - Show 4 options (`A`, `B`, `C`, `D`).
   - If `question.audio` is non-null, autoplay or offer a play button.
   - On answer, compare to `correctAnswer`. Show `explanation` if non-null.

Chapter books don't have quizzes today, so `story.quiz` will be null for them.

## Secondary language

`story.secondaryLanguage` is one of `'zh'`, `'ko'`, `'es'`, `'fr'`, or `null`.

When non-null, the picture book has secondary captions in that language:
- `pages[i].captionSecondary` — the translated caption
- `pages[i].audio.urlSecondary` — secondary-language narration MP3
- `pages[i].audio.textSecondary` — secondary-language narration text

Mobile should expose a language toggle in the reader UI when `secondaryLanguage` is set. The toggle swaps `caption` ↔ `captionSecondary` and `audio.url` ↔ `audio.urlSecondary`.

**Chapter book secondary-language is not implemented yet.** When it ships, the same shape will apply — `pages[i].htmlSecondary` will become a populated field. Mobile can future-proof by reading both `html` and `htmlSecondary` (the latter is currently undefined on the response and should be treated as "no translation available").

## Image handling

- Picture book scene images: PNG, JPEG, or WebP. Native `<Image>` handles all three on iOS 14+ / Android 4+.
- Chapter book cover images: PNG, JPEG, or WebP (most often WebP from the html2canvas snapshot pipeline). Same native support.
- Chapter book page images (inline within `html`): same — let the WebView load them.
- Aspect ratio is **NOT guaranteed**. Always render covers and scene images in a square frame with `resizeMode: 'cover'`. Page images inside chapter-book HTML carry their own sizing — let the WebView handle them.

## Publishing a story to a kid's profile

`POST /api/projects/[id]/publish-kids-app`

Body:
```jsonc
{
  "childProfileIds": ["uuid", "uuid", …],
  "category": "bedtime"   // optional, defaults to 'bedtime'
}
```

Validation per project type:

| Check | Picture book | Chapter book |
|---|---|---|
| Has content | scenes >= 1 | at least 1 page in canvas_state |
| Has images | every scene has a generated_image | not enforced (chapter books can be text-only) |
| Has audio | every scene has audio | **NOT enforced** — chapter books support silent reading |
| Has quiz audio | if quiz exists, all questions narrated | not applicable (chapter books don't have quizzes yet) |

The endpoint creates the same `publications` + `publication_targets` rows for both types. `platform_metadata` now includes:

```jsonc
{
  "category": "bedtime",
  "language": "en",
  "child_count": 2,
  "scene_count": 5,            // for back-compat — same as page_count
  "page_count": 5,             // NEW — explicit
  "project_type": "chapter_book",  // NEW — so mobile knows which renderer to use
  "has_quiz": false,
  "quiz_question_count": 0,
  "reading_level": "grade-2",
  "story_tone": "playful"
}
```

Mobile reads `platform_metadata.project_type` to know whether the published story is a chapter book or picture book, then fetches the detail endpoint (where `story.projectType` will match).

## Silent-reading UX for chapter books (REQUIRED BEFORE FIRST PUBLISH)

Because chapter books can be published to a kid's profile without audio, the kids app must handle pages where `page.audio === null`:

- **Don't auto-play anything.** No assumption that audio exists.
- **Per-page audio button**: enabled when audio is present, disabled (greyed out) when null. Tooltip / hint when long-press: "No audio yet — read this one yourself."
- **Navigation works without audio.** Kid taps next / prev or swipes to advance.
- **Optional: a "Have a grown-up read this to me" hint** for younger kids on chapter books with no audio.

When chapter-book narration ships later (server-side, no API change), every page will have `audio` populated and the same UI auto-upgrades.

## What's NOT changing

- **List endpoints** (`/api/stories/public` with various query params). Same response shape, same filter / search / sort / pagination semantics. Tag filters, search by title / author, sorting by recent / popular — all unchanged.
- **Picture book reader flow** if you keep consuming `scenes[]`. We keep `scenes[]` populated indefinitely. We strongly recommend migrating to `pages[]` for the unified renderer, but it's not breaking if you don't.
- **Publish-to-Spotify** flow. Out of scope for now.

## Migration path for the kids app

Suggested order:

1. **Phase 1** — Update TypeScript story model to include the new fields. Don't change any rendering yet.
2. **Phase 2** — Build a unified renderer that iterates `pages[]`. Branch on `page.kind` for layout (scene viewer vs WebView). Audio button reads `page.audio` directly.
3. **Phase 3** — Add silent-reading mode. Per-page audio button enabled/disabled by `page.audio` presence.
4. **Phase 4** — Test against both picture books (`scenes[]` and `pages[]` should render identically) and chapter books from the public feed.
5. **Phase 5** — Coordinate with web team: enable chapter-book publishing in the kids-app publish flow (web side already supports it server-side; verify it works end-to-end with mobile's new renderer).
6. **Phase 6** — Remove `scenes[]` consumption from mobile codebase (purely internal cleanup; web still emits it).

## Open questions for the mobile team

1. **Fonts:** OK to bundle Lora + Comic Neue TTFs locally for offline reading, or prefer to reference web URLs at runtime? The latter saves bundle size but breaks offline.
2. **Long chapter books:** Anything to cap on the mobile side? Web caps PDF export at 15 pages. For reading, what's a reasonable max?
3. **Audio language toggle:** Does the current picture-book UI handle the language toggle case? If yes, the same toggle should drive `audio.urlSecondary` selection. If not, this is new UX work — confirm scope.
4. **Quiz UX:** Does the current kids-app quiz screen already match the `Quiz` / `QuizQuestion` shape, or does it consume something different today? If different, send the current shape so we can align.

## Quick reference — example payloads

### Picture book story detail (truncated)

```jsonc
{
  "success": true,
  "story": {
    "id": "abc-123",
    "projectType": "picture_book",
    "title": "My Mom Is The Best",
    "authorName": "Luna",
    "authorAge": 6,
    "coverImageUrl": "https://kindlewood-studio.supabase.co/.../cover.jpeg",
    "coverAudio": {
      "url": "https://.../cover.mp3",
      "text": "My Mom Is The Best, by Luna age six",
      "durationSeconds": null,
      "urlSecondary": null,
      "textSecondary": null
    },
    "secondaryLanguage": null,
    "pages": [
      {
        "pageNumber": 1,
        "kind": "scene",
        "imageUrls": ["https://.../scene1.png"],
        "plainText": "Mommy makes pancakes every Saturday.",
        "caption": "Mommy makes pancakes every Saturday.",
        "captionSecondary": null,
        "audio": {
          "url": "https://.../page1.mp3",
          "text": "Mommy makes pancakes every Saturday.",
          "durationSeconds": null,
          "urlSecondary": null,
          "textSecondary": null
        }
      },
      // … more scenes
    ],
    "quiz": {
      "questions": [
        {
          "id": "q1",
          "order": 1,
          "question": "What does Mommy make on Saturdays?",
          "options": { "A": "Pancakes", "B": "Pizza", "C": "Sushi", "D": "Tacos" },
          "correctAnswer": "A",
          "explanation": "Mommy makes pancakes every Saturday!",
          "audio": { "url": "…", "text": "…", "durationSeconds": null, "urlSecondary": null, "textSecondary": null }
        }
      ],
      "transitionAudio": { "url": "…", "text": "Now let's see what you remember…", "durationSeconds": null, "urlSecondary": null, "textSecondary": null }
    },
    "scenes": [/* legacy — same data as pages, ignore in new code */]
  }
}
```

### Chapter book story detail (truncated)

```jsonc
{
  "success": true,
  "story": {
    "id": "def-456",
    "projectType": "chapter_book",
    "title": "From Picture Book to Chapter Book",
    "authorName": "Spark",
    "authorAge": null,
    "coverImageUrl": "https://.../cover.webp",
    "coverAudio": null,
    "secondaryLanguage": null,
    "pages": [
      {
        "pageNumber": 1,
        "kind": "page",
        "imageUrls": ["https://.../cover-art.webp"],
        "plainText": "From Picture Book to Chapter Book\nAuthor: Spark\n© 2026 KindleWood Studio",
        "html": "<p style=\"text-align:center\"><img src=\"https://.../cover-art.webp\" data-fullbleed=\"true\"></p><p style=\"text-align:center\">Author: Spark</p><p style=\"text-align:center\">© 2026 KindleWood Studio</p>",
        "audio": null
      },
      {
        "pageNumber": 2,
        "kind": "page",
        "imageUrls": [],
        "plainText": "Meet Spark. A little dragon who lives in KindleWood. When Spark was little, he loved giant picture books…",
        "html": "<h1 style=\"text-align:center; color:#16a34a\">Meet Spark</h1>…",
        "audio": null
      }
    ],
    "quiz": null,
    "scenes": []
  }
}
```

## Contact

Web team handles all API changes. File issues / questions in the shared backlog or DM the web maintainer. The API is versioned by URL; the current spec is `/api/v1`-implicit (we don't bump versions for additive changes). If a future change is breaking, we'll mint `/api/v2/...` and coexist.
