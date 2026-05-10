/**
 * FontSize — extends Tiptap's TextStyle with a fontSize attribute.
 *
 * Why a custom extension: Tiptap v3 ships TextStyle as the substrate for
 * inline-style marks (color, font-family, etc.) but doesn't include
 * fontSize. We add it as a TextStyle extension so all inline-style marks
 * coexist on a single <span style="…"> node — no nesting fights.
 *
 * Three-size palette intentional: ages 7–12 don't benefit from a full
 * point picker, and a small palette keeps PDF rendering predictable.
 */

import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

export const FONT_SIZES = {
  small: '16px',
  normal: '20px',
  large: '26px',
} as const;

export type FontSizeKey = keyof typeof FONT_SIZES;

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize || null,
            renderHTML: (attributes: { fontSize?: string | null }) => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (size: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: size }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}
