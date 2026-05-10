/**
 * PageBreak Tiptap node.
 *
 * Why kid-controlled, not auto-paginated: making "page" an explicit node
 * the kid inserts means audio narration (which chunks per page) and the
 * reader's prev/next navigation are deterministic. The starter doc seeds
 * a page break between cover and chapter 1 so kids see the concept on
 * first open.
 *
 * Stored as `{ type: 'pageBreak' }` — round-trips through JSON cleanly,
 * and the reader splits on this node type to build pages.
 */

import { mergeAttributes, Node } from '@tiptap/core';

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  // Atom block: doesn't contain content, can't be edited inline; kids
  // delete it as a single unit by hitting backspace on the next line.
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-page-break': 'true',
        class: 'chapter-book-page-break',
        // Aria-hidden because the reader rebuilds pages from this signal —
        // screen readers announce the next page heading naturally.
        'aria-hidden': 'true',
      }),
      ['span', { class: 'chapter-book-page-break-label' }, 'New Page'],
    ];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ chain }) => {
          // Insert page break + new paragraph as a single content array so
          // ProseMirror's cursor lands at the end of the inserted run (in
          // the empty paragraph). Inserting them in two separate calls
          // sometimes left the cursor stuck in the page-break atom, which
          // is why the button felt like it stopped working after a few
          // clicks. scrollIntoView pulls the new page into view on long
          // docs.
          return chain()
            .insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }])
            .scrollIntoView()
            .run();
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Cmd/Ctrl + Enter inserts a new page — natural for "I'm done with
      // this page, start the next one."
      'Mod-Enter': () => this.editor.commands.insertPageBreak(),
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}
