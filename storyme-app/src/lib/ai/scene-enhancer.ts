/**
 * AI Scene Enhancer
 * Uses Claude/OpenAI to enhance scene descriptions for better image generation
 * and create age-appropriate captions
 */

import { StoryTone } from '../types/story';

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
  raw_description: string;
  enhanced_prompt: string;
  caption: string;
  characterNames: string[];
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
 * Build system prompt for Claude API
 */
export function buildEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone
): string {
  const characterNames = characters.map(c => c.name).join(', ');
  const characterDescriptions = characters
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');

  return `You are a children's storybook expert specializing in creating engaging, age-appropriate stories.

STORY SETTINGS:
- Reading Level: ${readingLevel} years old
- Story Tone: ${storyTone}

CHARACTER INFORMATION:
${characterDescriptions}

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
Return a valid JSON array with this exact structure:
[
  {
    "sceneNumber": 1,
    "enhanced_prompt": "detailed visual description preserving character names",
    "caption": "age-appropriate story text with ${storyTone} tone"
  },
  {
    "sceneNumber": 2,
    "enhanced_prompt": "...",
    "caption": "..."
  }
]

Return ONLY the JSON array, no additional text.`;
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
    return parsed.map((item: any, index: number) => {
      const originalScene = originalScenes[index];

      if (!originalScene) {
        throw new Error(`Missing original scene for index ${index}`);
      }

      return {
        sceneNumber: originalScene.sceneNumber,
        raw_description: originalScene.rawDescription,
        enhanced_prompt: item.enhanced_prompt || originalScene.rawDescription,
        caption: item.caption || originalScene.rawDescription,
        characterNames: originalScene.characterNames
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
