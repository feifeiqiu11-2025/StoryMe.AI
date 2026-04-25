/**
 * Cover Prompt Builder
 * Reusable function to build cover image prompts
 * Extracted from /api/generate-cover for reuse in /api/enhance-scenes
 */

export interface CoverPromptInput {
  title: string;
  description?: string;
  characterNames: string[];
  language?: 'en' | 'zh';
  /** Optional story-bible primary location. When provided, its locked visual description
   * is appended as a Setting: block so the cover anchors to the same place the first
   * scene uses — prevents cover/first-scene forest drift. Callers should pass scene 1's
   * location (or the first indexed location) when bible data is available. */
  primaryLocation?: { name: string; description: string };
}

/**
 * Build a cover image generation prompt
 * Follows the same logic as /api/generate-cover
 * @param input - Cover context
 * @returns Cover generation prompt string
 */
export function buildCoverPrompt(input: CoverPromptInput): string {
  const {
    title,
    description,
    characterNames,
    language = 'en',
    primaryLocation,
  } = input;

  // Extract character names for default scene
  const charactersText = characterNames.join(' and ') || 'the main characters';

  // Text handling based on language
  // English: Include title in image (AI-rendered text)
  // Chinese: Leave space for title (add as overlay later due to font issues)
  const textInstructions = language === 'en'
    ? `Add title "${title}" at top in stylized letters. No other text.`
    : `NO TEXT on image. Leave space at top for title.`;

  // Build cover description
  const storyContext = description ? `Story theme: ${description}. ` : '';
  const settingBlock = primaryLocation
    ? ` Setting: ${primaryLocation.description}`
    : '';
  const coverPrompt = `Book COVER for "${title}". ${storyContext}Show ${charactersText} — each character must match their attached reference image — in an exciting moment, dynamic poses, colorful background.${settingBlock} ${textInstructions}`;

  return coverPrompt;
}
