/**
 * AI Scene Enhancer
 * Uses Claude/OpenAI to enhance scene descriptions for better image generation
 * and create age-appropriate captions
 * Also supports story expansion based on expansion level
 */

import { StoryTone, ExpansionLevel } from '../types/story';

export interface SceneToEnhance {
  sceneNumber: number;
  rawDescription: string;
  characterNames: string[];
}

export interface Character {
  name: string;
  description: string;
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
}

/**
 * Get tone-specific guidelines for AI prompt
 */
function getToneGuidelines(tone: StoryTone): string {
  const guidelines = {
    playful: `
      - Use upbeat, energetic language
      - Include words like "fun", "happy", "exciting", "joy"
      - Convey lightheartedness and delight
      - Examples: "giggled", "bounced", "danced", "cheered", "played"
    `,
    educational: `
      - Introduce learning moments naturally
      - Use descriptive, informative vocabulary
      - Explain "why" or "how" when appropriate
      - Examples: "discovered", "learned", "noticed", "found out", "realized"
    `,
    adventure: `
      - Use action-oriented, dynamic language
      - Include elements of courage and exploration
      - Create excitement and anticipation
      - Examples: "explored", "brave", "journey", "quest", "discovered", "ventured"
    `,
    gentle: `
      - Use soft, calming, soothing language
      - Focus on peaceful, comforting moments
      - Slower pacing, reflective and serene tone
      - Examples: "softly", "gently", "peaceful", "cozy", "warm", "calm"
    `,
    silly: `
      - Embrace absurdity, humor, and playfulness
      - Use playful exaggeration and funny imagery
      - Make it whimsical and giggle-worthy
      - Examples: "gigantic", "whoops", "wibbly-wobbly", "uh-oh", "silly", "wacky"
    `,
    mystery: `
      - Create curiosity, wonder, and intrigue
      - Use questioning language and build anticipation
      - Encourage imagination and discovery
      - Examples: "wondered", "curious", "secret", "discovered", "mysterious", "hidden"
    `,
    friendly: `
      - Emphasize relationships, togetherness, and warmth
      - Use inclusive, cooperative language
      - Highlight sharing, kindness, and connection
      - Examples: "together", "friends", "helped", "shared", "kind", "caring"
    `,
    brave: `
      - Focus on overcoming challenges and building confidence
      - Use empowering, encouraging language
      - Validate emotions while inspiring courage
      - Examples: "tried", "confident", "strong", "proud", "brave", "fearless"
    `
  };

  return guidelines[tone];
}

/**
 * Get reading level guidelines for AI prompt
 */
function getReadingLevelGuidelines(readingLevel: number): string {
  if (readingLevel <= 4) {
    return `
      - Age 3-4: Very simple language
      - Use 1-2 syllable words only
      - Sentence length: 3-5 words per sentence
      - Maximum 2 sentences
      - Example: "Emma plays. She is happy."
    `;
  } else if (readingLevel === 5) {
    return `
      - Age 5: Simple, clear language
      - Use mostly simple words, occasional 3-syllable words
      - Sentence length: 5-8 words per sentence
      - Maximum 2-3 sentences
      - Example: "Emma went to the park. She had so much fun!"
    `;
  } else if (readingLevel === 6) {
    return `
      - Age 6: Building vocabulary
      - More word variety, some compound words
      - Sentence length: 8-12 words per sentence
      - Maximum 3 sentences
      - Example: "Emma was playing at the sunny park with her friends."
    `;
  } else {
    return `
      - Age 7-8: Richer vocabulary and complexity
      - Use descriptive words, varied sentence structure
      - Sentence length: 10-15 words per sentence
      - Maximum 3-4 sentences
      - Example: "Emma discovered a magical playground where all the swings sparkled in the sunlight."
    `;
  }
}

/**
 * Get target scene count based on expansion level and reading level
 */
function getTargetSceneCount(
  originalSceneCount: number,
  readingLevel: number,
  expansionLevel: ExpansionLevel
): number {
  if (expansionLevel === 'minimal') {
    return originalSceneCount; // Keep same count
  }

  if (expansionLevel === 'smart') {
    // Age-based smart expansion
    if (readingLevel <= 4) return Math.min(Math.ceil(originalSceneCount * 2), 8);
    if (readingLevel <= 6) return Math.min(Math.ceil(originalSceneCount * 2.5), 10);
    return Math.min(Math.ceil(originalSceneCount * 3), 12);
  }

  // Rich expansion
  return Math.max(12, Math.min(Math.ceil(originalSceneCount * 3), 15));
}

/**
 * Get expansion-specific instructions for AI
 */
function getExpansionInstructions(
  expansionLevel: ExpansionLevel,
  originalSceneCount: number,
  targetSceneCount: number,
  characterNames: string
): string {
  if (expansionLevel === 'minimal') {
    return `
EXPANSION LEVEL: MINIMAL (Keep Original Story)
- You MUST create EXACTLY ${originalSceneCount} scenes (same as input)
- DO NOT add new scenes or change the story structure
- DO NOT add new characters beyond: ${characterNames}
- ONLY enhance the captions to be age-appropriate and clear
- Keep the user's original story spirit intact
- Focus on improving language quality, not adding content
    `;
  }

  if (expansionLevel === 'smart') {
    return `
EXPANSION LEVEL: SMART (Age-Based Expansion)
- Original scenes: ${originalSceneCount}
- Target scenes: ${targetSceneCount}
- Expand the story with transitional scenes and details
- You MAY add minor supporting characters if needed (parents, friends, pets)
- Label any new characters with "(NEW)" in characterNames
- Add sensory details (colors, sounds, feelings)
- Add simple dialogue appropriate for the age
- Add small plot elements (minor challenges, discoveries)
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
 * Build system prompt for Claude API
 */
export function buildEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'minimal'
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
    "characterNames": ["Emma", "Mom"]
  },
  {
    "sceneNumber": 2,
    "title": "...",
    "enhanced_prompt": "...",
    "caption": "...",
    "characterNames": ["Emma"]
  }
]

IMPORTANT:
- Return EXACTLY ${targetSceneCount} scenes in the array
- Include "title" for each scene (helps users preview)
- List all character names appearing in each scene
- Mark new characters with "(NEW)" suffix if you added them
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
        isNewCharacter: item.characterNames?.some((name: string) => name.includes('(NEW)')) || false
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
