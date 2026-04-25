import type { Character } from '@/lib/types/story';

export interface DetectedCharacter {
  character: Character;
  matchedOn: string; // which name token triggered the match
}

export interface DetectedLocation {
  tempId: string;
  name: string;
  description: string;
  referenceImageUrl?: string | null;
  matchedOn: string;
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

/**
 * Detect which story-bible locations are mentioned in an edit instruction.
 * Mirrors character matching: whole-word, case-insensitive, any token of the location name.
 * Needed because bible locations are NOT Character rows, so detectCharactersInInstruction
 * never picks them up (that's why "Enchanted Forest" gets missed today).
 */
export function detectLocationsInInstruction(
  instruction: string,
  locations: Array<{ temp_id: string; name: string; description: string; reference_image_url?: string | null; backing_character_name?: string | null }>,
  dismissedTempIds?: Set<string>,
): DetectedLocation[] {
  if (!instruction.trim() || !locations?.length) return [];

  const detected: DetectedLocation[] = [];
  const seen = new Set<string>();

  for (const loc of locations) {
    if (seen.has(loc.temp_id)) continue;
    if (dismissedTempIds?.has(loc.temp_id)) continue;
    if (loc.backing_character_name) continue; // Backing-char locations surface as characters already; avoid double-detection.

    const nameTokens = loc.name.split(/\s+/).filter(t => t.length > 0);
    for (const token of nameTokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      if (regex.test(instruction)) {
        detected.push({
          tempId: loc.temp_id,
          name: loc.name,
          description: loc.description,
          referenceImageUrl: loc.reference_image_url ?? null,
          matchedOn: token,
        });
        seen.add(loc.temp_id);
        break;
      }
    }
  }

  return detected;
}
