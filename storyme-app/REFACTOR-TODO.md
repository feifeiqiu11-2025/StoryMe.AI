# Refactor TODO — Shared components for project detail pages

**Filed:** 2026-05-09 — alongside chapter-book Phase A.

## Why

Today there are two parallel detail pages:
- `src/app/(dashboard)/projects/[id]/page.tsx` — picture books, ~2,500 lines
- `src/app/(dashboard)/chapter-books/[id]/page.tsx` — chapter books, ~400 lines

Both render the same conceptual UI: cover header, privacy toggle,
share-link, PDF export, tags, audio, Spotify, Kids App, edit, delete.
The two pages duplicate the layout/styling but operate on different
underlying data shapes (scenes vs. canvas_state).

This was a deliberate Phase-A decision: branching the picture-book page
to handle chapter books risked regressions in the picture-book flow.
The trade-off is duplication — fixes have to land in two places.

## What to extract

The natural shared pieces, with current locations:

1. **`<CoverHeader>`** — cover image, title, author, primary CTAs (Read,
   Edit, etc.). Picture book: inline in `projects/[id]/page.tsx`.
   Chapter book: inline in `chapter-books/[id]/page.tsx`.

2. **`<VisibilityToggle>` / `<PrivacyCard>`** — Private / Share-by-link
   / Public 3-up grid. Picture book: inline. Chapter book: inline.

3. **`<TagEditor>`** — add/remove tags via `project_tags`. Picture
   book has a heavy version with admin-only add. Chapter book skipped
   for v1 — should pick this up when extracted.

4. **`<DeleteCard>`** — danger-zone with confirm dance. Picture book:
   inline. Chapter book: inline.

5. **`<AdminActions>`** — Featured toggle, edit-back-to-draft (admin
   only). Picture book: inline. Chapter book: not present.

`<ShareLinkPopover>` is already shared (`src/components/story/ShareLinkPopover.tsx`).

## How

- Move each piece into `src/components/project-detail/`.
- Make them prop-driven (no inline fetches inside the components).
- Update both pages to compose them.
- Remove the duplicated inline JSX once both pages match.

## When

Defer until either:
- A Phase-B feature (audio, Spotify, Kids App for chapter books)
  reveals divergence pain, or
- A new project type appears (would force the third page).

This is not a freezing-the-codebase change — both pages can keep
evolving independently in the meantime.
