/**
 * AI Scene Enhancer
 * Uses Claude/OpenAI to enhance scene descriptions for better image generation
 * and create age-appropriate captions
 * Also supports story expansion based on expansion level
 */

import { StoryTone, ExpansionLevel } from '../types/story';
import type { CharacterType } from '../types/story';

export interface SceneToEnhance {
  sceneNumber: number;
  rawDescription: string;
  characterNames: string[];
}

export interface Character {
  name: string;
  description: string;
  isAnimal?: boolean; // AI-detected: true for animals/creatures, false for humans
}

export interface EnhancedSceneResult {
  sceneNumber: number;
  title?: string;                // Scene title for preview
  raw_description: string;
  enhanced_prompt: string;
  caption: string;
  caption_chinese?: string;      // Chinese translation (NEW - Bilingual Support)
  characterNames: string[];
  isNewCharacter?: boolean;      // Flag if AI added new character
  characterTypes?: CharacterType[]; // AI-detected character types for this scene
}

/**
 * Get tone-specific guidelines for AI prompt.
 *
 * Active tones: playful (absorbs old 'silly'), educational, adventure (absorbs old 'brave'), friendly.
 * Removed tones: gentle, silly, mystery, brave — keywords merged into remaining tones.
 */
function getToneGuidelines(tone: StoryTone): string {
  const guidelines: Record<string, string> = {
    playful: `
      - Use upbeat, energetic language
      - Include words like "fun", "happy", "exciting", "joy"
      - Convey lightheartedness and delight
      - Embrace humor, playful exaggeration, and whimsical imagery
      - Examples: "giggled", "bounced", "danced", "cheered", "played", "whoops", "uh-oh", "wacky"
    `,
    educational: `
      - Introduce learning moments naturally
      - Use descriptive, informative vocabulary
      - Explain "why" or "how" when appropriate
      - Examples: "discovered", "learned", "noticed", "found out", "realized"
    `,
    adventure: `
      - Use action-oriented, dynamic language
      - Include elements of courage, exploration, and overcoming challenges
      - Create excitement and anticipation
      - Validate emotions while inspiring confidence
      - Examples: "explored", "brave", "journey", "quest", "ventured", "confident", "strong", "proud"
    `,
    friendly: `
      - Emphasize relationships, togetherness, and warmth
      - Use inclusive, cooperative language
      - Highlight sharing, kindness, and connection
      - Examples: "together", "friends", "helped", "shared", "kind", "caring"
    `,
  };

  return guidelines[tone] || guidelines.playful;
}

/**
 * Get reading level guidelines for AI prompt.
 * Supports ages 1-12. Internal Lexile mapping for AI reference.
 */
function getReadingLevelGuidelines(readingLevel: number): string {
  if (readingLevel <= 2) {
    return `
      - Age 1-2: Minimal language (~100-200L Lexile, Pre-K)
      - Use single words or 2-3 word phrases
      - Sentence length: 1-3 words
      - Maximum 1-2 phrases
      - Example: "Dog!" or "Mommy. Ball."
    `;
  } else if (readingLevel <= 4) {
    return `
      - Age 3-4: Very simple language (~200-400L Lexile, Pre-K)
      - Use 1-2 syllable words only
      - Sentence length: 3-5 words per sentence
      - Maximum 2 sentences
      - Example: "Emma plays. She is happy!"
    `;
  } else if (readingLevel === 5) {
    return `
      - Age 5: Simple, clear language (~400L Lexile, Kindergarten)
      - Use mostly simple words, occasional 3-syllable words
      - Sentence length: 5-8 words per sentence
      - Maximum 2-3 sentences
      - Example: "Emma went to the park. She had so much fun!"
    `;
  } else if (readingLevel === 6) {
    return `
      - Age 6: Building vocabulary (~500L Lexile, Grade 1)
      - More word variety, some compound words
      - Sentence length: 8-12 words per sentence
      - Maximum 3 sentences
      - Example: "Emma was playing at the sunny park with her friends."
    `;
  } else if (readingLevel <= 8) {
    return `
      - Age 7-8: Richer vocabulary (~600-700L Lexile, Grade 2-3)
      - Use descriptive words, varied sentence structure
      - Sentence length: 10-15 words per sentence
      - Maximum 3-4 sentences
      - Example: "Emma discovered a magical playground where all the swings sparkled in the sunlight."
    `;
  } else if (readingLevel <= 10) {
    return `
      - Age 9-10: Complex narratives (~800-900L Lexile, Grade 4-5)
      - Use varied vocabulary, figurative language, and descriptive detail
      - Sentence length: 12-20 words per sentence
      - Maximum 4-5 sentences
      - Include character thoughts, dialogue, and emotional nuance
      - Example: "Emma hesitated at the edge of the forest, wondering if she was brave enough to find the hidden waterfall her grandmother had told her about."
    `;
  } else {
    return `
      - Age 11-12: Advanced narratives (~1000-1050L Lexile, Grade 6-7)
      - Use rich vocabulary, complex sentence structures, and literary techniques
      - Sentence length: 15-25 words per sentence
      - Maximum 5-6 sentences
      - Include subtext, character motivation, and thematic depth
      - Example: "The old map had been tucked inside a library book for decades, its faded ink revealing a path that no one in town remembered — but Emma was determined to follow it."
    `;
  }
}

/**
 * Get target scene count based on expansion level and reading level.
 *
 * as_written: exact same count (script used verbatim)
 * light: at least original count, up to ~2x (never reduces)
 * rich: 12-15 scenes
 */
function getTargetSceneCount(
  originalSceneCount: number,
  readingLevel: number,
  expansionLevel: ExpansionLevel
): number {
  if (expansionLevel === 'as_written') {
    return originalSceneCount;
  }

  if (expansionLevel === 'light') {
    // Light expansion: never reduce, may add some scenes
    if (readingLevel <= 4) return Math.max(originalSceneCount, Math.min(Math.ceil(originalSceneCount * 1.5), 8));
    if (readingLevel <= 6) return Math.max(originalSceneCount, Math.min(Math.ceil(originalSceneCount * 1.5), 10));
    if (readingLevel <= 8) return Math.max(originalSceneCount, Math.min(Math.ceil(originalSceneCount * 2), 12));
    // Ages 9-12: can expand a bit more
    return Math.max(originalSceneCount, Math.min(Math.ceil(originalSceneCount * 2), 15));
  }

  // Rich expansion: 12-15 scenes
  return Math.max(12, Math.min(Math.ceil(originalSceneCount * 3), 15));
}

/**
 * Get expansion-specific instructions for AI.
 *
 * as_written: captions are the user's script verbatim, only generate image prompts
 * light: enhance captions + may add transitional scenes (never reduce count)
 * rich: full creative expansion
 */
function getExpansionInstructions(
  expansionLevel: ExpansionLevel,
  originalSceneCount: number,
  targetSceneCount: number,
  characterNames: string
): string {
  if (expansionLevel === 'as_written') {
    return `
EXPANSION LEVEL: AS WRITTEN (Preserve User's Exact Script)
- You MUST create EXACTLY ${originalSceneCount} scenes (same as input)
- DO NOT add new scenes or change the story structure
- DO NOT add new characters beyond: ${characterNames}
- For CAPTIONS: use the user's EXACT original text VERBATIM — do NOT change any words, vocabulary, sentence structure, or punctuation
  - The child wrote this themselves and wants their own words preserved
  - Do NOT adjust for reading level — the user chose "As Written" specifically to keep their script unchanged
  - Only fix obvious typos if present (misspelled words), nothing else
- For ENHANCED IMAGE PROMPTS: create vivid visual descriptions for image generation (this is where you add detail)
- Keep the user's original story spirit fully intact
    `;
  }

  if (expansionLevel === 'light') {
    return `
EXPANSION LEVEL: LIGHT EXPANSION
- Original scenes: ${originalSceneCount}
- Target scenes: ${targetSceneCount}
- IMPORTANT: You MUST create AT LEAST ${originalSceneCount} scenes (never reduce count)
- Enhance captions to be age-appropriate, clear, and engaging
- You MAY add transitional scenes for better story flow
- You MAY add minor supporting characters if needed (parents, friends, pets)
- Label any new characters with "(NEW)" in characterNames
- Add sensory details (colors, sounds, feelings)
- Add simple dialogue appropriate for the age
- Maintain clear story arc: beginning → middle → end
- MUST preserve user's main characters: ${characterNames}
    `;
  }

  // Rich expansion
  return `
EXPANSION LEVEL: RICH (Full Creative Expansion)
- Original scenes: ${originalSceneCount}
- Target scenes: ${targetSceneCount} (12-15 scenes)
- Create a fully developed narrative with rich storytelling
- Add dialogue, character development, emotional moments
- You MAY add supporting characters (label with "(NEW)")
- Add mini story arcs, conflicts, and resolutions
- Create detailed settings and atmospheres
- Add character thoughts and emotions
- MUST preserve user's main characters: ${characterNames}
- Keep core theme from original script
  `;
}

/**
 * Build system prompt for AI scene enhancement.
 *
 * Prompt layering order:
 *   1. Story settings (reading level, tone, scene count)
 *   2. Character information
 *   3. Story category guidance (from template, if selected)
 *   4. Expansion instructions
 *   5. Tone guidelines
 *   6. Reading level guidelines
 *   7. Task instructions + output format
 */
export function buildEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'as_written',
  templateBasePrompt?: string
): string {
  const characterNames = characters.map(c => c.name).join(', ');
  const characterDescriptions = characters
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  const targetSceneCount = getTargetSceneCount(scenes.length, readingLevel, expansionLevel);
  const expansionInstructions = getExpansionInstructions(
    expansionLevel,
    scenes.length,
    targetSceneCount,
    characterNames
  );

  return `You are a children's storybook expert specializing in creating engaging, age-appropriate stories.

STORY SETTINGS:
- Reading Level: ${readingLevel} years old
- Story Tone: ${storyTone}
- Input Scenes: ${scenes.length}
- Target Output: ${targetSceneCount} scenes

CHARACTER INFORMATION:
${characterDescriptions}
${templateBasePrompt ? `
STORY CATEGORY GUIDANCE:
${templateBasePrompt}
` : ''}
${expansionInstructions}

TONE GUIDELINES FOR "${storyTone.toUpperCase()}":
${getToneGuidelines(storyTone)}

READING LEVEL GUIDELINES:
${getReadingLevelGuidelines(readingLevel)}

YOUR TASK:
For each scene provided, you must create TWO different texts:

1. ENHANCED IMAGE PROMPT (for AI image generation):
   - Add vivid visual details (colors, lighting, facial expressions, body language)
   - Preserve ALL character names EXACTLY as provided: ${characterNames}
   - Include composition guidance (foreground/background elements)
   - Specify setting details, weather, time of day if relevant
   - Keep it descriptive and visual (under 200 characters)
   - DO NOT include the caption text here - this is purely for image generation
   - IMPORTANT: Dress characters in THEME-APPROPRIATE clothing:
     * Christmas/Winter story → cozy winter clothes, Christmas sweaters, Santa hats, warm jackets
     * Summer/Beach story → swimsuits, shorts, t-shirts, sun hats
     * Halloween story → costumes (witch, superhero, princess, etc.)
     * Birthday party → party clothes, birthday hats
     * Bedtime story → pajamas, nightgowns
     * School story → school uniforms or casual clothes
     * Default → casual play clothes appropriate for the activity
   - Be CONSISTENT with clothing across ALL scenes in the same story

2. STORY CAPTION (for the storybook PDF):
   - Age-appropriate text for ${readingLevel}-year-olds
   - Apply the "${storyTone}" tone consistently
   - Follow reading level guidelines strictly
   - Keep emotional resonance appropriate for young children
   - Maximum 2-3 sentences (shorter for younger ages)
   - This is what children will READ in the book

CRITICAL RULES:
- ALWAYS preserve character names exactly as provided
- Enhanced prompts should be VISUAL and DESCRIPTIVE
- Captions should be AGE-APPROPRIATE and match the TONE
- The two outputs serve different purposes - keep them distinct
- Maintain consistency across all scenes in the story

3. CHARACTER TYPE DETECTION (for each character in the scene):
   - Determine if each character is an ANIMAL or HUMAN based on their description
   - ANIMAL = cats, dogs, birds, dragons, unicorns, bears, rabbits, etc.
   - HUMAN = people, boys, girls, mothers, fathers, grandparents, etc.
   - This is used to generate correct clothing in images (animals don't wear human clothes)

INPUT SCENES:
${scenes.map((s, i) => `Scene ${s.sceneNumber}: "${s.rawDescription}" (Characters: ${s.characterNames.join(', ') || 'all'})`).join('\n')}

OUTPUT FORMAT:
Return a valid JSON array with ${targetSceneCount} scenes in this exact structure:
[
  {
    "sceneNumber": 1,
    "title": "Brief scene title (5-7 words)",
    "enhanced_prompt": "detailed visual description preserving character names",
    "caption": "age-appropriate story text with ${storyTone} tone",
    "characterNames": ["Emma", "Mom"],
    "characterTypes": [{"name": "Emma", "isAnimal": false}, {"name": "Mom", "isAnimal": false}]
  },
  {
    "sceneNumber": 2,
    "title": "...",
    "enhanced_prompt": "...",
    "caption": "...",
    "characterNames": ["Emma", "Miaomiao"],
    "characterTypes": [{"name": "Emma", "isAnimal": false}, {"name": "Miaomiao", "isAnimal": true}]
  }
]

IMPORTANT:
- Return EXACTLY ${targetSceneCount} scenes in the array
- Include "title" for each scene (helps users preview)
- List all character names appearing in each scene
- Mark new characters with "(NEW)" suffix if you added them
- Include characterTypes for EVERY character in the scene (isAnimal: true for animals, false for humans)
- Return ONLY the JSON array, no additional text.`;
}

/**
 * Parse AI response into structured format
 */
export function parseEnhancementResponse(
  response: string,
  originalScenes: SceneToEnhance[]
): EnhancedSceneResult[] {
  try {
    // Try to extract JSON from response (in case AI adds extra text)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : response;

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    // Validate and merge with original scene data
    // Note: With expansion, we might have MORE scenes than original
    return parsed.map((item: any, index: number) => {
      const originalScene = originalScenes[Math.min(index, originalScenes.length - 1)];

      return {
        sceneNumber: item.sceneNumber || (index + 1),
        title: item.title || `Scene ${index + 1}`,
        raw_description: originalScene?.rawDescription || item.caption,
        enhanced_prompt: item.enhanced_prompt || item.caption,
        caption: item.caption || originalScene?.rawDescription || 'No description',
        characterNames: item.characterNames || originalScene?.characterNames || [],
        isNewCharacter: item.characterNames?.some((name: string) => name.includes('(NEW)')) || false,
        characterTypes: item.characterTypes || undefined // AI-detected animal vs human for each character
      };
    });

  } catch (error) {
    console.error('Failed to parse AI response:', error);
    console.error('Response was:', response);
    throw new Error('Failed to parse AI enhancement response');
  }
}

/**
 * Create fallback enhancement (when AI fails)
 */
export function createFallbackEnhancement(
  scenes: SceneToEnhance[]
): EnhancedSceneResult[] {
  return scenes.map(scene => ({
    sceneNumber: scene.sceneNumber,
    raw_description: scene.rawDescription,
    enhanced_prompt: scene.rawDescription, // Use raw as-is
    caption: scene.rawDescription,         // Use raw as-is
    characterNames: scene.characterNames
  }));
}
