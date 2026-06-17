/**
 * AI Scene Enhancer
 * Uses Claude/OpenAI to enhance scene descriptions for better image generation
 * and create age-appropriate captions
 * Also supports story expansion based on expansion level
 */

import { StoryTone, ExpansionLevel } from '../types/story';
import type { CharacterType } from '../types/story';
import type { StoryArchitecture } from './story-templates';

export interface SceneToEnhance {
  sceneNumber: number;
  rawDescription: string;
  characterNames: string[];
}

export interface Character {
  name: string;
  description: string;
  isAnimal?: boolean; // AI-detected: true for animals/creatures, false for humans
  // Optional fields used by the story-bible pipeline; ignored by the legacy enhancer.
  id?: string;                 // character_library UUID (needed to resolve names → IDs after bible pass)
  subjectType?: string;        // 'human' | 'animal' | 'animated_object' | 'scene' | 'scenery' — signals location candidates
  role?: 'character' | 'scene_element'; // User's explicit "Use as" toggle; authoritative over subjectType for scene-eligibility
}

export interface EnhancedSceneResult {
  sceneNumber: number;
  title?: string;                // Scene title for preview
  raw_description: string;
  enhanced_prompt: string;
  caption: string;
  caption_chinese?: string;      // Chinese translation (kept for backward compat)
  caption_secondary?: string;   // Generic secondary language caption
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
 * light: 10-12 scenes (flexible architecture)
 * rich: 15 scenes (strict architecture with more plot depth)
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
    // Light: 10-12 scenes (flexible)
    return Math.max(10, Math.min(12, Math.max(originalSceneCount, 10)));
  }

  // Rich: Always 15 scenes for deeper plot and more images
  return 15;
}

/**
 * Get expansion-specific instructions for AI.
 *
 * as_written: captions are the user's script verbatim, only generate image prompts
 * light: enhance captions + follow architecture flexibly
 * rich: full creative expansion following architecture strictly
 */
function getExpansionInstructions(
  expansionLevel: ExpansionLevel,
  originalSceneCount: number,
  targetSceneCount: number,
  characterNames: string,
  architecture?: StoryArchitecture
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
    const architectureGuidance = architecture ? `
STORY ARCHITECTURE (FLEXIBLE GUIDANCE):
The story should follow this narrative structure, but adapt if the user's script has a different flow:

${architecture.requiredBeats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

Scene Flow:
${architecture.sceneFlowGuidance}

Try to include these pedagogical elements:
${architecture.pedagogicalCheckpoints.map((cp, i) => `• ${cp}`).join('\n')}

IMPORTANT: Use this architecture as a GUIDE. If the user's script already has good flow, enhance it rather than forcing this structure.
` : '';

    return `
EXPANSION LEVEL: LIGHT EXPANSION
- Original input lines: ${originalSceneCount} (some may be instructions rather than scenes)
- Target scenes: approximately ${targetSceneCount} (10-12 scenes based on actual scene content)
- Enhance captions to be age-appropriate, clear, and engaging
- Add transitional scenes to improve story flow and complete narrative arc
- You MAY add minor supporting characters if needed (parents, friends, pets)
- Label any new characters with "(NEW)" in characterNames
- Add sensory details (colors, sounds, feelings)
- Add simple dialogue appropriate for the age
- MUST preserve user's main characters: ${characterNames}

SCENE FLOW & PACING:
- Ensure smooth logical flow between consecutive scenes — the reader should never feel confused about what happened between scenes
- If the user's script has gaps in flow, add bridging scenes to connect them naturally
- Spend fewer scenes on setup and ending; dedicate more scenes to the middle — rising action, deepening conflict, and climax
- Each scene should feel like a natural continuation of the previous one, not an abrupt topic change
${architectureGuidance}`;
  }

  // Rich expansion
  const architectureGuidance = architecture ? `
STORY ARCHITECTURE (REQUIRED STRUCTURE):
This story MUST follow this narrative arc. Reorganize the user's scenes to fit this structure:

${architecture.requiredBeats.map((beat, i) => `${i + 1}. ${beat}`).join('\n')}

Scene Flow Requirements:
${architecture.sceneFlowGuidance}

Required Pedagogical Checkpoints (ALL MUST BE ADDRESSED):
${architecture.pedagogicalCheckpoints.map((cp, i) => `✓ ${cp}`).join('\n')}

YOUR TASK WITH ARCHITECTURE:
1. Read the user's script and identify which story beats are already present
2. Reorganize scenes to fit the required narrative arc above
3. Add scenes where needed to complete missing beats
4. Ensure ALL pedagogical checkpoints are addressed
5. Create logical flow from beginning → middle → end
6. The user's script may be incomplete or out of order - your job is to structure it properly while preserving their core ideas and characters

CRITICAL: ENFORCE CAUSE-AND-EFFECT LOGIC
- NEVER jump from problem to solution without showing the process
- Add transitional scenes that show HOW and WHY things happen
- Use explicit cause-effect connections: "BECAUSE X happened, Y occurs" or "X does Y, WHICH CAUSES Z"
- Show character MOTIVATION before actions (why does the character decide to do something?)
- Show the PROCESS, not just the outcome (if magic fixes something, show HOW it's used)
- Each scene should logically lead to the next - no abrupt jumps
` : '';

  return `
EXPANSION LEVEL: RICH (Full Creative Expansion)
- Original input lines: ${originalSceneCount} (some may be instructions rather than scenes)
- Target scenes: approximately ${targetSceneCount} (aim for 15 scenes based on actual scene content)
- Create a fully developed narrative with rich storytelling and clear cause-effect flow
- Add dialogue, character development, emotional moments
- You MAY add supporting characters (label with "(NEW)")
- Add mini story arcs, conflicts, and resolutions
- Create detailed settings and atmospheres
- Add character thoughts and emotions
- Show the PROCESS of events, not just outcomes
- MUST preserve user's main characters: ${characterNames}
- Keep core theme from original script

SCENE FLOW & PACING:
- Ensure smooth logical flow between consecutive scenes — the reader should never feel confused or lost about what happened between scenes
- If one scene introduces a wonder, discovery, or challenge, the following scene must acknowledge it before moving on
- Spend fewer scenes on the beginning setup and the ending wrap-up; dedicate more scenes to the middle of the story — the rising action, deepening conflict, and climax
- Avoid repetitive endings: once the resolution is reached, wrap up concisely rather than restating the outcome across multiple scenes
- Each scene should feel like a natural continuation of the previous one, not an abrupt topic change
${architectureGuidance}`;
}

/**
 * Build system prompt for AI scene enhancement.
 *
 * Prompt layering order:
 *   1. Story settings (reading level, tone, scene count)
 *   2. Character information
 *   3. Story category guidance (from template, if selected)
 *   4. Story architecture (narrative structure)
 *   5. Expansion instructions
 *   6. Tone guidelines
 *   7. Reading level guidelines
 *   8. Task instructions + output format
 */
export function buildEnhancementPrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'as_written',
  templateBasePrompt?: string,
  storyArchitecture?: StoryArchitecture,
  rawScript?: string
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
    characterNames,
    storyArchitecture
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

${rawScript && expansionLevel !== 'as_written' ? `USER'S RAW INPUT (for context):
"""
${rawScript}
"""

IMPORTANT - INSTRUCTION DETECTION:
The user's input above may contain a mix of:
1. SCENE DESCRIPTIONS — narrative content describing what happens (e.g., "Connor finds a treasure map")
2. META-INSTRUCTIONS — directives about how to create the story (e.g., "only use these two characters", "make it a bedtime story", "keep scenes short")
3. STORY CONCEPTS — a general idea without specific scenes (e.g., "a fun story about exploring nature")

Your task:
- Identify any meta-instructions and apply them as HIGH-PRIORITY CONSTRAINTS for the entire story
- Only generate scenes from lines that are actual story/scene content
- If the input is mostly a story concept with few or no specific scenes, generate a well-structured story from that concept
- The scene count may differ from the number of input lines if some lines are instructions rather than scenes
- Meta-instructions OVERRIDE other settings (e.g., if user says "keep it short", prioritize that over target scene count)

` : ''}INPUT SCENES:
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
- Return approximately ${targetSceneCount} scenes in the array (adjust if some input lines are instructions rather than scenes)
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

// ============================================
// STORY BIBLE — pronoun resolution + location clustering
// ============================================
//
// The bible pass is a superset of the existing enhancer: in one LLM call it still
// produces enhanced_prompt + caption per scene, AND additionally:
//   - clusters distinct locations with locked visual descriptions,
//   - resolves pronouns per scene into explicit character names,
//   - links each scene to a location id (defaulting to the previous scene's
//     location when the script doesn't indicate a change).
//
// Character and location identifiers in the LLM output are NAMES, not UUIDs
// (LLMs preserve names reliably; UUIDs not so much). Callers map names back to
// UUIDs using the input character list + the returned location temp_ids.

export interface BibleLocation {
  temp_id: string;            // stable within this response: loc_1, loc_2, ...
  name: string;
  description: string;        // 25–40 words, specific to THIS story
  backing_character_name?: string | null; // matches a scene-type character by exact name, or null
  first_scene_index: number;  // 0-based index of the first scene using this location
  // Populated by /api/locations/generate-references after enhance (Phase 3). Null during
  // the brief window between enhance returning and the background generation completing.
  reference_image_url?: string | null;
}

export interface BibleScene extends EnhancedSceneResult {
  location_temp_id?: string | null;     // references BibleLocation.temp_id
  resolved_character_names?: string[];  // pronouns resolved to explicit names from the input list
}

// A recurring character implied by the script but NOT in the user's provided
// character list (e.g. "a little girl in a red dress" who appears across scenes).
// Surfaced so we can pre-generate a consistent reference image for it, exactly
// like a location. Only emitted for characters appearing in >= 2 scenes.
export interface NewBibleCharacter {
  temp_id: string;            // stable within this response: char_1, char_2, ...
  name: string;               // short name/label
  description: string;        // 20–30 words, locked visual description
  first_scene_index: number;  // 0-based index of the first scene using this character
  // Populated by /api/characters/generate-references after enhance. Null during
  // the window between enhance returning and the reference generation completing.
  reference_image_url?: string | null;
}

export interface StoryBibleResult {
  locations: BibleLocation[];
  // Recurring characters the model introduced that weren't in the input list.
  // Optional for backward-compatibility with older saved bibles.
  new_characters?: NewBibleCharacter[];
  scenes: BibleScene[];
}

export function buildStoryBiblePrompt(
  scenes: SceneToEnhance[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone,
  expansionLevel: ExpansionLevel = 'as_written',
  templateBasePrompt?: string,
  storyArchitecture?: StoryArchitecture,
  rawScript?: string
): string {
  const characterNames = characters.map(c => c.name).join(', ');
  const characterDescriptions = characters
    .map(c => {
      const typeTag = c.subjectType ? ` [subject_type=${c.subjectType}]` : '';
      return `- ${c.name}${typeTag}: ${c.description}`;
    })
    .join('\n');

  // Scene-eligibility: the explicit "Use as" toggle (`role`) is authoritative.
  // - role='character'     → never a location, even if subjectType drifted to 'scenery'
  // - role='scene_element' → always a location
  // - role unset (legacy)  → fall back to the subjectType heuristic
  // Fixes a class of bugs where a regular character (e.g. Spark the dragon)
  // ends up as a scene's location because Gemini mis-classified its image as
  // scenery during analyze-character.
  const sceneTypeCharacters = characters.filter(c => {
    if (c.role === 'character') return false;
    if (c.role === 'scene_element') return true;
    return c.subjectType === 'scene' || c.subjectType === 'scenery';
  });
  const sceneCharNote = sceneTypeCharacters.length > 0
    ? `\nSCENE-TYPE CHARACTERS (eligible to back a location):
${sceneTypeCharacters.map(c => `- ${c.name}`).join('\n')}
`
    : '';

  const targetSceneCount = getTargetSceneCount(scenes.length, readingLevel, expansionLevel);
  const expansionInstructions = getExpansionInstructions(
    expansionLevel,
    scenes.length,
    targetSceneCount,
    characterNames,
    storyArchitecture
  );

  return `You are a children's storybook expert AND a story analyst. You will both enhance scenes and produce a "story bible" that locks in location consistency and resolves pronouns.

STORY SETTINGS:
- Reading Level: ${readingLevel} years old
- Story Tone: ${storyTone}
- Input Scenes: ${scenes.length}
- Target Output: ${targetSceneCount} scenes

CHARACTER INFORMATION:
${characterDescriptions}
${sceneCharNote}${templateBasePrompt ? `
STORY CATEGORY GUIDANCE:
${templateBasePrompt}
` : ''}
${expansionInstructions}

TONE GUIDELINES FOR "${storyTone.toUpperCase()}":
${getToneGuidelines(storyTone)}

READING LEVEL GUIDELINES:
${getReadingLevelGuidelines(readingLevel)}

YOUR TASK — produce TWO things together:

A) LOCATIONS (story bible)
   Identify the distinct background SETTINGS used across the story. A setting is the broad
   environment/backdrop of a scene — not a small object, prop, or focal spot within it; do
   not promote a focal detail into its own setting. Create a new setting ONLY when the
   backdrop genuinely changes to a different PLACE; scenes that share the same surroundings
   share one setting even if they zoom in on different details within it. Do NOT create a
   separate setting for each stage or step of a process or life cycle that happens in the
   same place — those are ONE setting. Use only as many settings as there are genuinely
   distinct places — do not over-split, but do keep genuinely different places separate. For each:
   - Give it a short, human-readable name (2–5 words).
   - Write a LOCKED visual description (25–40 words) specific to THIS story — concrete landmarks, lighting, mood. This description will be reused verbatim for every scene in that location, so make it specific enough that two separate images of this location would look the same.
   - If a SCENE-TYPE CHARACTER listed above is clearly this location, set backing_character_name to that character's exact name AND set the location's name to the SAME exact name (do NOT invent variations like "Rainbow House Morning" — use just "Rainbow House"). Otherwise backing_character_name is null and you may pick any descriptive name.
   - Assign a stable temp_id (loc_1, loc_2, ...) in order of first appearance.

B) SCENES
   For each scene produce:
   - title, enhanced_prompt, caption, characterNames, characterTypes (as before)
   - location_temp_id: which location from (A) this scene takes place in. DEFAULT to the previous scene's location unless the script explicitly indicates a change (e.g., "then she went home", "the next day at school"). Never leave this null unless no location can be inferred for the whole story.
   - resolved_character_names: the persistent CHARACTERS present in this scene — a person, or a specific recurring animal that acts across scenes — with ALL pronouns resolved to explicit names from the character list above (or to a new character you introduce in C). "He walked in" → if Connor is the most recent male subject, include "Connor". The topic's SUBJECT and its life stages or forms are NOT characters: if a scene only shows the subject (no persistent person/animal), return an empty list. Never leave a pronoun unresolved.

C) NEW CHARACTERS (a PERSISTENT individual not in the provided list — a person, or one specific animal — that recurs across scenes)
   For each one that appears in 2 OR MORE scenes WITH THE SAME, UNCHANGED appearance:
   - temp_id: a stable id (char_1, char_2, ...) in order of first appearance.
   - name: a short, stable label — a name if one is given, otherwise a brief descriptive label.
   - description: a LOCKED 20–30 word visual description (concrete appearance, clothing, colors) so two separate images of this character would look the same.
   - first_scene_index: 0-based index of the first scene they appear in.
   Do NOT include the topic's subject, a creature that changes or grows across scenes, or any of its life stages/forms — render those per scene and NEVER create a separate character for each stage. Return an empty array if there are none (a factual topic often has none).

CRITICAL RULES:
- Use the provided characters by their EXACT names: ${characterNames || '(none provided)'}. Do not invent UUIDs. Preserve provided character names exactly.
- NEW CHARACTERS: only list a PERSISTENT individual (a person, or one specific animal) that appears in 2+ scenes with the SAME unchanged appearance; give it a short stable label. Do NOT create a character for a one-off person in a single scene; do NOT turn a setting/place/object into a character (those are LOCATIONS); do NOT extract the topic's subject or a creature that changes/grows across scenes — render its stages/forms per scene and NEVER split one subject into a character per stage; and never invent a fictional narrator or anthropomorphize (no talking animals).
- location_temp_id values must match one of the temp_ids you returned in (A).
- If a scene contains no characters at all (pure scenery), return an empty array for resolved_character_names.
- Keep enhanced_prompt and caption semantics identical to a standard enhancement.

3. CHARACTER TYPE DETECTION (per character in each scene):
   - ANIMAL = cats, dogs, birds, dragons, unicorns, bears, rabbits, etc.
   - HUMAN = people, boys, girls, mothers, fathers, grandparents, etc.

${rawScript && expansionLevel !== 'as_written' ? `USER'S RAW INPUT (for context):
"""
${rawScript}
"""

IMPORTANT - INSTRUCTION DETECTION:
The user's input above may contain a mix of:
1. SCENE DESCRIPTIONS — narrative content.
2. META-INSTRUCTIONS — directives about how to create the story.
3. STORY CONCEPTS — a general idea without specific scenes.

Apply meta-instructions as HIGH-PRIORITY CONSTRAINTS. Only generate scenes from actual story content.

` : ''}INPUT SCENES:
${scenes.map((s) => `Scene ${s.sceneNumber}: "${s.rawDescription}" (Characters: ${s.characterNames.join(', ') || 'all'})`).join('\n')}

OUTPUT FORMAT:
Return a single valid JSON OBJECT (not an array) with this exact shape:
{
  "locations": [
    {
      "temp_id": "loc_1",
      "name": "short human-readable name",
      "description": "25-40 words, specific visual description",
      "backing_character_name": null,
      "first_scene_index": 0
    }
  ],
  "new_characters": [
    {
      "temp_id": "char_1",
      "name": "short name or label",
      "description": "20-30 words, locked visual description",
      "first_scene_index": 0
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Brief scene title",
      "enhanced_prompt": "detailed visual description preserving character names",
      "caption": "age-appropriate story text",
      "characterNames": ["Connor"],
      "characterTypes": [{"name": "Connor", "isAnimal": false}],
      "location_temp_id": "loc_1",
      "resolved_character_names": ["Connor"]
    }
  ]
}

Return ONLY the JSON object, no additional text, no markdown fences.`;
}

// ============================================
// STORY BIBLE — refresh stale scene prompts after chip edits
// ============================================
//
// Used by /api/refresh-prompts. Given the full bible + characters + settings
// plus a subset of "stale" scenes (those whose character list or location was
// edited via chips), produce fresh enhanced_prompt for just those scenes.
//
// Captions are NEVER rewritten here — they belong to the user's voice and
// stay exactly as written. Only the image-generation prompt updates so the
// rendered image reflects the new characters / location.

export interface SceneForRefresh {
  sceneNumber: number;
  raw_description: string;
  resolved_character_names: string[];
  location_temp_id?: string | null;
}

export interface RefreshedScene {
  sceneNumber: number;
  enhanced_prompt: string;
}

export function buildRefreshPromptsPrompt(
  scenesToRefresh: SceneForRefresh[],
  allScenesForContext: Array<{ sceneNumber: number; caption: string }>,
  locations: BibleLocation[],
  characters: Character[],
  readingLevel: number,
  storyTone: StoryTone
): string {
  const characterNames = characters.map(c => c.name).join(', ');
  const characterDescriptions = characters
    .map(c => `- ${c.name}: ${c.description}`)
    .join('\n');
  const locationsList = locations
    .map(l => `- ${l.temp_id} (${l.name}): ${l.description}`)
    .join('\n');
  const contextList = allScenesForContext
    .map(s => `Scene ${s.sceneNumber}: ${s.caption || '(no caption yet)'}`)
    .join('\n');
  const toRefreshList = scenesToRefresh.map(s => {
    const loc = s.location_temp_id ? locations.find(l => l.temp_id === s.location_temp_id) : undefined;
    return `Scene ${s.sceneNumber}:
  raw: "${s.raw_description}"
  characters now present: ${s.resolved_character_names.join(', ') || '(none — pure scenery)'}
  location: ${loc ? `${loc.name} — ${loc.description}` : '(none)'}`;
  }).join('\n\n');

  return `You are updating image-generation prompts for a children's storybook after the user edited which characters appear in specific scenes or which location a scene takes place in. Rewrite ONLY the image-generation prompt for each affected scene.

DO NOT produce captions. Captions are owned by the user and must not change here.

STORY SETTINGS (for tone/vocabulary context only):
- Reading level: ${readingLevel} years old
- Tone: ${storyTone}

CHARACTERS:
${characterDescriptions}

LOCATIONS (locked visual descriptions — use verbatim for setting):
${locationsList}

ALL SCENE CAPTIONS (for narrative context — DO NOT rewrite any of these):
${contextList}

SCENES TO REFRESH:
${toRefreshList}

For each scene listed above produce ONLY:
- enhanced_prompt: vivid visual description under 200 chars; MUST include ONLY the characters now present (drop any character removed); MUST use the location's locked visual description as the setting.

Preserve character names from this list exactly: ${characterNames}.

Return ONLY a JSON object:
{
  "scenes": [
    { "sceneNumber": N, "enhanced_prompt": "..." }
  ]
}
No "caption" field. No markdown, no prose outside the JSON.`;
}

export function parseRefreshPromptsResponse(response: string): RefreshedScene[] {
  const objMatch = response.match(/\{[\s\S]*\}/);
  const jsonStr = objMatch ? objMatch[0] : response;
  const parsed = JSON.parse(jsonStr);
  const rawScenes = Array.isArray(parsed?.scenes) ? parsed.scenes : [];
  return rawScenes
    .filter((s: any) => typeof s?.sceneNumber === 'number' && typeof s?.enhanced_prompt === 'string')
    .map((s: any) => ({
      sceneNumber: s.sceneNumber,
      enhanced_prompt: String(s.enhanced_prompt),
    }));
}

export function parseStoryBibleResponse(
  response: string,
  originalScenes: SceneToEnhance[],
  characters?: Character[]
): StoryBibleResult {
  // Extract JSON object (tolerate surrounding prose or markdown fences)
  const objMatch = response.match(/\{[\s\S]*\}/);
  const jsonStr = objMatch ? objMatch[0] : response;

  const parsed = JSON.parse(jsonStr);

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Story bible response is not a JSON object');
  }

  const rawLocations = Array.isArray(parsed.locations) ? parsed.locations : [];
  const rawScenes = Array.isArray(parsed.scenes) ? parsed.scenes : [];

  if (rawScenes.length === 0) {
    throw new Error('Story bible response contains no scenes');
  }

  // Defense against model hallucinating a character name as a location.
  // Names of non-scene-element characters are NEVER valid location names. If
  // the model returned one (e.g. "Spark" as Scene 2's setting), drop it; the
  // scene's location_temp_id will fall through to null and the user can pick
  // a real location in the UI. scene_element rows are allowed through —
  // those legitimately back locations (Rainbow House, etc.).
  const nonLocationNames = new Set<string>();
  for (const c of characters || []) {
    const isExplicitSceneElement = c.role === 'scene_element';
    const isLegacySceneType = !c.role && (c.subjectType === 'scene' || c.subjectType === 'scenery');
    if (!isExplicitSceneElement && !isLegacySceneType) {
      nonLocationNames.add(c.name.toLowerCase());
    }
  }

  const locations: BibleLocation[] = rawLocations
    .filter((loc: any) => loc && typeof loc.temp_id === 'string' && typeof loc.name === 'string' && typeof loc.description === 'string')
    .filter((loc: any) => {
      if (nonLocationNames.size === 0) return true;
      const locName = String(loc.name).toLowerCase();
      const backingName = String(loc.backing_character_name ?? '').toLowerCase();
      if (nonLocationNames.has(locName) || nonLocationNames.has(backingName)) {
        console.warn(`[parseStoryBibleResponse] Dropping hallucinated location "${loc.name}" — matches a character name`);
        return false;
      }
      return true;
    })
    .map((loc: any, idx: number) => ({
      temp_id: String(loc.temp_id),
      name: String(loc.name),
      description: String(loc.description),
      backing_character_name: loc.backing_character_name ?? null,
      first_scene_index: typeof loc.first_scene_index === 'number' ? loc.first_scene_index : idx,
    }));

  const validTempIds = new Set(locations.map(l => l.temp_id));

  // New characters the model introduced (recurring, not in the provided list).
  // Drop any whose name matches a provided character — those aren't "new".
  const providedNames = new Set((characters || []).map(c => c.name.toLowerCase()));
  // Count how many distinct scenes each name appears in (resolved_character_names),
  // so we can ENFORCE the "recurring (>=2 scenes)" rule in code. The model doesn't
  // reliably count and tends to emit single-scene subjects — e.g. each life-cycle
  // stage of one transforming subject — as separate characters. Those should be
  // rendered per scene, not tracked, so we drop anything that isn't truly recurring.
  const sceneNameCounts = new Map<string, number>();
  for (const s of rawScenes) {
    const names = Array.isArray(s?.resolved_character_names) ? s.resolved_character_names : [];
    const seen = new Set<string>();
    for (const n of names) {
      if (typeof n === 'string' && n.trim()) {
        const key = n.toLowerCase();
        if (!seen.has(key)) { seen.add(key); sceneNameCounts.set(key, (sceneNameCounts.get(key) || 0) + 1); }
      }
    }
  }
  // Conservative guard: only enforce the recurrence filter when the model actually
  // populated resolved_character_names somewhere. If it populated none, we have no
  // signal — keep the model's list rather than dropping everything (avoids nuking a
  // legitimate recurring character just because labels weren't echoed).
  const hasResolvedNames = sceneNameCounts.size > 0;
  const newCharacters: NewBibleCharacter[] = (Array.isArray(parsed.new_characters) ? parsed.new_characters : [])
    .filter((ch: any) => ch && typeof ch.temp_id === 'string' && typeof ch.name === 'string' && typeof ch.description === 'string')
    .filter((ch: any) => !providedNames.has(String(ch.name).toLowerCase()))
    // Enforce recurrence: must actually appear in >=2 distinct scenes. Drops single-
    // scene subjects (life-cycle stages, one-off figures) that shouldn't be characters.
    .filter((ch: any) => !hasResolvedNames || (sceneNameCounts.get(String(ch.name).toLowerCase()) || 0) >= 2)
    .map((ch: any, idx: number) => ({
      temp_id: String(ch.temp_id),
      name: String(ch.name),
      description: String(ch.description),
      first_scene_index: typeof ch.first_scene_index === 'number' ? ch.first_scene_index : idx,
    }));

  const scenes: BibleScene[] = rawScenes.map((item: any, index: number) => {
    const originalScene = originalScenes[Math.min(index, originalScenes.length - 1)];

    const rawLocTempId = typeof item.location_temp_id === 'string' ? item.location_temp_id : null;
    const locationTempId = rawLocTempId && validTempIds.has(rawLocTempId) ? rawLocTempId : null;

    const resolvedNames = Array.isArray(item.resolved_character_names)
      ? item.resolved_character_names.filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
      : [];

    return {
      sceneNumber: item.sceneNumber || (index + 1),
      title: item.title || `Scene ${index + 1}`,
      raw_description: originalScene?.rawDescription || item.caption,
      enhanced_prompt: item.enhanced_prompt || item.caption,
      caption: item.caption || originalScene?.rawDescription || 'No description',
      characterNames: item.characterNames || originalScene?.characterNames || [],
      isNewCharacter: item.characterNames?.some((name: string) => typeof name === 'string' && name.includes('(NEW)')) || false,
      characterTypes: item.characterTypes || undefined,
      location_temp_id: locationTempId,
      resolved_character_names: resolvedNames,
    };
  });

  return { locations, new_characters: newCharacters, scenes };
}
