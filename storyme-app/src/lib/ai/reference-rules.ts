/**
 * Shared, provider-agnostic prompt rule for character reference images.
 *
 * Both the Gemini and OpenAI scene generators import this single string so the
 * "the attached image is the source of truth" instruction is WORDED IDENTICALLY
 * across providers. Previously only Gemini asserted reference authority; OpenAI
 * did not, which let the model fall back to name priors (e.g. the character
 * named "Dory" rendered as the famous cartoon fish instead of the attached
 * photo of a girl). Keeping the rule in one place prevents the two paths from
 * drifting again.
 *
 * Deliberately does NOT mention "human"/"animal" — species is whatever the
 * reference image shows, so the rule must never contradict it.
 */
export const REFERENCE_AUTHORITATIVE_RULE =
  'Characters WITH a reference image: the attached IMAGE is the AUTHORITATIVE source for visual identity — species, body shape, colors, and distinguishing features. If the name and the image disagree, FOLLOW THE IMAGE, not the name or any assumption the name implies.';

/**
 * Build the per-image binding line so each reference is tied to the right
 * character ("Image 1 IS Dory — ..."). Stronger than a passive "appear
 * faithfully" list: it tells the model which attached image maps to which name,
 * so identities don't swap when several references are sent at once.
 */
export function buildReferenceBindingLine(index: number, label: string): string {
  return `  - Image ${index + 1} IS ${label}`;
}
