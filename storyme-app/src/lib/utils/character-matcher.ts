import type { Character } from '@/lib/types/story';

export interface DetectedCharacter {
  character: Character;
  matchedOn: string; // which name token triggered the match
}

/**
 * Detect which story characters are mentioned in an edit instruction.
 *
 * Matching rules:
 * - Single-word name ("Rex"): exact whole-word match, case-insensitive.
 * - Multi-word name ("Cat Molly"): match if ANY name token appears as a
 *   whole word. "cat" or "molly" → matches "Cat Molly".
 * - Uses word boundary regex (\b) so "cat" does NOT match "caterpillar".
 * - Matches against character.name tokens ONLY (not descriptions).
 * - Deduplicates: if multiple tokens of the same character match, returns
 *   the character once with the first matched token.
 */
export function detectCharactersInInstruction(
  instruction: string,
  characters: Character[],
  dismissedNames?: Set<string>,
): DetectedCharacter[] {
  if (!instruction.trim() || !characters.length) return [];

  const detected: DetectedCharacter[] = [];
  const seenIds = new Set<string>();

  for (const character of characters) {
    if (seenIds.has(character.id)) continue;
    if (dismissedNames?.has(character.id)) continue;

    const nameTokens = character.name
      .split(/\s+/)
      .filter(t => t.length > 0);

    for (const token of nameTokens) {
      // Escape special regex characters in the token
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');

      if (regex.test(instruction)) {
        detected.push({ character, matchedOn: token });
        seenIds.add(character.id);
        break; // one match per character is enough
      }
    }
  }

  return detected;
}
