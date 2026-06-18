/**
 * Shared prompt builders for character generation.
 * Used by both gemini-image-client.ts and openai-image-client.ts so the
 * kid_creation faithfulness prompt stays consistent across providers.
 */

import type { ImageMedium } from './types/story';

export type CharacterStyle = 'pixar' | 'classic';

interface KidCreationPromptOptions {
  style: CharacterStyle;
  /** When true, prepends the explicit "USE THE ATTACHED IMAGE" line that Gemini needs. */
  emphasizeReference?: boolean;
  /** Optional character name for context. */
  name?: string;
  /**
   * Verbatim description of what the analyzer saw in the drawing. Used as an
   * explicit element checklist so the model doesn't drop items (e.g., a crown
   * floating next to a witch). Pass briefDescription from analyzeCharacterImage.
   */
  elementsDescription?: string;
}

/**
 * Faithfulness-first prompt for child handmade creations
 * (drawings, finger paint, playdoh, lego, paper craft, etc).
 *
 * Goal: render an animated version that the child still recognizes as their work.
 * Avoid normalizing the creation into a generic Pixar-style version.
 *
 * Note: this prompt intentionally avoids any "single subject" / "head-and-shoulders"
 * biasing language so the model preserves multi-element drawings (e.g., a character
 * plus separate floating objects) instead of reducing them to the dominant subject.
 */
export function buildKidCreationPrompt(opts: KidCreationPromptOptions): string {
  const { style, emphasizeReference = false, name, elementsDescription } = opts;

  const reference = emphasizeReference
    ? 'USE THE ATTACHED IMAGE as the primary source — the text below is supporting context only.\n\n'
    : '';

  const styleLine =
    style === 'pixar'
      ? '3D animated rendering — soft textures, warm flattering light, like a Pixar still.'
      : '2D illustrated rendering — soft watercolor feel, warm tones, classic storybook quality.';

  const subjectLine = name ? `Subject: ${name}.\n\n` : '';

  const elementsBlock = elementsDescription
    ? `ELEMENTS PRESENT IN THE DRAWING:
${elementsDescription}
Render EVERY element listed above. Do not omit any character, object, or accessory the child drew.

`
    : '';

  return `${reference}Render an animated version of this child's handmade creation (drawing, painting, finger paint, playdoh, lego, paper craft, or similar).

${subjectLine}${elementsBlock}PRIMARY GOAL — HONOR THE CHILD'S WORK:
- The animated result must be instantly recognizable as the same creation. A child should look at it and say "that's MY drawing/sculpture, just polished."
- Preserve the child's INTENTIONAL choices: proportions, color palette, distinctive features, and overall character.
- Treat unusual choices (non-realistic colors, simplified or exaggerated shapes, missing or extra features) as deliberate artistic decisions and keep them.
- Do NOT normalize or "correct" the creation into a generic version of what it depicts.

DO NOT preserve obvious unintentional artifacts (smudges, stray pencil marks, paper folds, lighting glare on the photo of the artwork). A stray line is not a feature; a clearly drawn shape is.

LIGHT POLISH (secondary):
- Smoother edges, refined shading, gentle lighting.
- ${styleLine}
- Maintain the original spatial layout — keep elements roughly where the child placed them.

CONTEXT: This is for a children's storybook app for ages 5-8. The child made the original — your job is to celebrate their work, not replace it.`;
}

/**
 * Map a medium value to the appropriate prompt-building strategy.
 * Currently only kid_creation diverges from the legacy verbose prompts.
 */
export function shouldUseFaithfulnessPrompt(medium: ImageMedium | undefined): boolean {
  return medium === 'kid_creation' || medium === 'digital_art';
}

/**
 * "Polish" prompt for the chapter-book My Art flow.
 *
 * Unlike buildKidCreationPrompt (which RE-RENDERS the art into a polished
 * Pixar/watercolor style — that's the Create New transform path), polish is
 * a light touch: clean the lines and remove photo artifacts WITHOUT
 * restyling. The kid's drawing must stay recognizably theirs — they pick
 * Original vs Polished afterwards.
 *
 * Kept deliberately short: image models follow tight, unambiguous edit
 * instructions more reliably than long ones. The three load-bearing rules
 * are "don't restyle", "only tidy", and "don't change elements". Tune here.
 */
export function buildPolishPrompt(): string {
  return `Gently clean up this child's drawing — keep it unmistakably theirs.

- Keep the same style, medium, colors, proportions, and layout. Do NOT restyle, cartoon-ify, or 3D-render it.
- Only tidy up: smooth shaky lines (keep the hand-drawn feel), even out the colors already there, and remove photo glare, smudges, and background.
- Do NOT add, remove, or move anything.`;
}
