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
    language = 'en'
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
  const coverPrompt = `Book COVER for "${title}". ${storyContext}Show ${charactersText} in an exciting moment, dynamic poses, colorful background. ${textInstructions}`;

  return coverPrompt;
}
