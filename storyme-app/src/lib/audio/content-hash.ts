/**
 * Normalized SHA-256 hash for page text — used to detect "stale" audio when
 * the underlying narration text changes (chapter book editor edits, picture
 * book caption edits).
 *
 * Normalization rule (must stay in lockstep with the comment on the
 * `content_hash` column in 20260523_add_content_hash_and_chapter_page_type.sql):
 *   - trim each line
 *   - collapse internal whitespace to single spaces
 *   - drop empty lines
 *   - PRESERVE all punctuation (commas, periods drive TTS pauses — changing
 *     punctuation should invalidate the audio)
 *   - PRESERVE letter case (TTS pronounces names case-sensitively in some
 *     voices and the user may intentionally change capitalization)
 */

import { createHash } from 'crypto';

export function normalizePageText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line.length > 0)
    .join('\n');
}

export function hashPageContent(text: string): string {
  const normalized = normalizePageText(text);
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
