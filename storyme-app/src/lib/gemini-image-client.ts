/**
 * Gemini Image Generation Client
 *
 * Uses Google Gemini for character-consistent story image generation.
 * Key advantage: Actually uses uploaded character reference images for consistency.
 *
 * Updated to use new @google/genai SDK with proper imageConfig support
 * for aspect ratio control (1:1 square images to match Fal.ai).
 */

import { GoogleGenAI, Modality } from '@google/genai';
import { CharacterDescription, ClothingConsistency, SubjectType } from './types/story';

export interface GeminiCharacterInfo {
  name: string;
  referenceImageUrl: string;
  description: CharacterDescription;
}

export interface GeminiGenerateParams {
  characters: GeminiCharacterInfo[];
  sceneDescription: string;
  artStyle?: string;
  /** Controls whether character clothing stays consistent or adapts to scene context */
  clothingConsistency?: ClothingConsistency;
}

export interface GeminiGenerateResult {
  imageUrl: string; // data URL (base64)
  generationTime: number;
  seed: number;
  prompt: string;
}

/**
 * Build minimal character description for prompt
 *
 * Since Gemini uses the actual reference PHOTO for appearance (face, skin, hair),
 * we provide minimal text as FALLBACK only:
 * 1. Character name - to label which photo is which
 * 2. Key features (skin tone, hair) - backup if photo reference fails
 * 3. Clothing will be added separately based on scene/theme
 *
 * The photo is the primary source of truth, text is secondary fallback.
 */
function buildMinimalCharacterDescription(
  name: string,
  description: CharacterDescription
): string {
  // Only include essential identifying features as fallback
  const fallbackFeatures: string[] = [];

  if (description.skinTone) {
    fallbackFeatures.push(description.skinTone + ' skin');
  }
  if (description.hairColor) {
    fallbackFeatures.push(description.hairColor + ' hair');
  }
  if (description.age) {
    fallbackFeatures.push(description.age);
  }

  if (fallbackFeatures.length > 0) {
    return `${name} (${fallbackFeatures.join(', ')})`;
  }
  return name;
}

/**
 * Detect if scene description mentions specific clothing/costume for a character
 * Returns the clothing/costume description if found, null otherwise
 */
function detectSceneClothing(sceneDescription: string, characterName: string): string | null {
  const lowerScene = sceneDescription.toLowerCase();
  const lowerName = characterName.toLowerCase();

  // First, check if character is mentioned in the scene
  if (!lowerScene.includes(lowerName)) {
    return null;
  }

  // Try to find clothing specifically associated with this character
  // Pattern: "[Name] wearing/dressed/in [clothing]"
  const characterClothingPatterns = [
    // "Connor wearing a doctor coat"
    new RegExp(`${lowerName}\\s+wearing\\s+(?:a\\s+)?([^,\\.]+)`, 'i'),
    // "Connor dressed as a pirate"
    new RegExp(`${lowerName}\\s+dressed\\s+(?:as|in|like)\\s+(?:a\\s+)?([^,\\.]+)`, 'i'),
    // "Connor in his pajamas" or "Connor in a superhero costume"
    new RegExp(`${lowerName}\\s+in\\s+(?:his|her|their|a|an)?\\s*([^,\\.]+?(?:pajamas|costume|outfit|uniform|clothes|coat|dress|suit))`, 'i'),
    // "Connor as a doctor" (role-based)
    new RegExp(`${lowerName}\\s+as\\s+(?:a\\s+)?([^,\\.]+)`, 'i'),
    // "Connor with a cape"
    new RegExp(`${lowerName}\\s+with\\s+(?:a\\s+)?([^,\\.]+?(?:cape|hat|mask|crown|wand|sword|shield))`, 'i'),
  ];

  for (const pattern of characterClothingPatterns) {
    const match = pattern.exec(sceneDescription);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  // Check for general costume keywords in the scene that might apply to all characters
  const generalCostumeKeywords = [
    'doctor', 'nurse', 'chef', 'pirate', 'princess', 'prince', 'superhero',
    'firefighter', 'police', 'astronaut', 'cowboy', 'fairy', 'wizard', 'witch',
    'vampire', 'zombie', 'ghost', 'mummy', 'skeleton', 'santa', 'elf',
    'pajamas', 'pyjamas', 'nightgown', 'swimsuit', 'swimming', 'ballet',
    'uniform', 'costume', 'formal', 'gown', 'tuxedo',
  ];

  for (const keyword of generalCostumeKeywords) {
    if (lowerScene.includes(keyword)) {
      // Check if it's contextually about clothing (not just a location like "doctor's office")
      const clothingContext = [
        `wearing.*${keyword}`,
        `dressed.*${keyword}`,
        `${keyword}.*costume`,
        `${keyword}.*outfit`,
        `as a ${keyword}`,
        `like a ${keyword}`,
      ];

      for (const ctx of clothingContext) {
        if (new RegExp(ctx, 'i').test(lowerScene)) {
          return keyword;
        }
      }
    }
  }

  return null;
}

// Simple in-memory cache for reference images (cleared on server restart)
// This avoids re-fetching the same image multiple times in a multi-scene story
const imageCache = new Map<string, { base64: string; mimeType: string; timestamp: number }>();
const IMAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Fetch image from URL and convert to base64 (with caching)
 */
async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  // Check cache first
  const cached = imageCache.get(url);
  if (cached && (Date.now() - cached.timestamp) < IMAGE_CACHE_TTL) {
    console.log(`[Gemini] Using cached image for: ${url.substring(0, 50)}...`);
    return { base64: cached.base64, mimeType: cached.mimeType };
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = response.headers.get('content-type') || 'image/jpeg';

  // Cache the result
  imageCache.set(url, { base64, mimeType, timestamp: Date.now() });

  // Clean up old cache entries (keep cache size manageable)
  if (imageCache.size > 20) {
    const oldestKey = [...imageCache.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0][0];
    imageCache.delete(oldestKey);
  }

  return { base64, mimeType };
}

/**
 * Detect story theme from scene description to suggest appropriate clothing
 */
function detectStoryTheme(description: string): string | null {
  const lowerDesc = description.toLowerCase();

  // Christmas/Winter theme
  if (lowerDesc.includes('christmas') || lowerDesc.includes('santa') ||
      lowerDesc.includes('north pole') || lowerDesc.includes('reindeer') ||
      lowerDesc.includes('snowman') || lowerDesc.includes('holiday') ||
      lowerDesc.includes('xmas') || lowerDesc.includes('present') && lowerDesc.includes('snow')) {
    return 'christmas';
  }

  // Halloween theme
  if (lowerDesc.includes('halloween') || lowerDesc.includes('trick or treat') ||
      lowerDesc.includes('pumpkin') || lowerDesc.includes('spooky') ||
      lowerDesc.includes('costume party') || lowerDesc.includes('haunted')) {
    return 'halloween';
  }

  // Beach/Summer theme
  if (lowerDesc.includes('beach') || lowerDesc.includes('swimming') ||
      lowerDesc.includes('pool') || lowerDesc.includes('ocean') ||
      lowerDesc.includes('sand castle') || lowerDesc.includes('summer')) {
    return 'beach';
  }

  // Bedtime theme
  if (lowerDesc.includes('bedtime') || lowerDesc.includes('sleep') ||
      lowerDesc.includes('dream') || lowerDesc.includes('night') && lowerDesc.includes('bed') ||
      lowerDesc.includes('goodnight') || lowerDesc.includes('pajama')) {
    return 'bedtime';
  }

  // Birthday theme
  if (lowerDesc.includes('birthday') || lowerDesc.includes('party') && lowerDesc.includes('cake') ||
      lowerDesc.includes('celebration') || lowerDesc.includes('balloons') && lowerDesc.includes('presents')) {
    return 'birthday';
  }

  // Winter (non-Christmas)
  if (lowerDesc.includes('snow') || lowerDesc.includes('winter') ||
      lowerDesc.includes('ice skating') || lowerDesc.includes('sledding') ||
      lowerDesc.includes('cold') || lowerDesc.includes('freezing')) {
    return 'winter';
  }

  return null;
}

// NOTE: getThemeClothing was removed - we no longer auto-add theme clothing
// Clothing is now controlled by:
// 1. User's explicit clothing mentions in scene script (e.g., "wearing Christmas pajamas")
// 2. Character's base clothing from description.clothing
// 3. If neither, AI picks appropriate casual clothing

/**
 * Detect if scene contains animals (for prompt enhancement)
 */
function sceneContainsAnimals(description: string): boolean {
  const animalKeywords = [
    'dog', 'cat', 'bird', 'fish', 'rabbit', 'bunny', 'hamster', 'turtle',
    'horse', 'pony', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck',
    'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'bear',
    'wolf', 'fox', 'deer', 'owl', 'eagle', 'snake', 'frog', 'butterfly',
    'zoo', 'farm', 'barn', 'wildlife', 'safari', 'aquarium', 'pet',
    'animal', 'creature', 'beast',
  ];

  const lowerDesc = description.toLowerCase();
  return animalKeywords.some(animal => lowerDesc.includes(animal));
}

// ============================================================================
// CHARACTER TYPE DETECTION & SMART PROMPT BUILDING
// ============================================================================

// NOTE: Animal detection is now done during character creation (CharacterFormModal)
// and stored in description.isAnimal. This ensures the user's intent is captured
// at the source rather than trying to infer it from text patterns.

/**
 * Detect EXPLICIT clothing mentions in scene description
 * Only triggers when user explicitly writes about specific costumes/outfits
 *
 * IMPORTANT: Does NOT auto-add clothing based on theme/setting
 * e.g., "at the zoo in winter" does NOT add winter jacket
 * e.g., "wearing Christmas pajamas" DOES add Christmas pajamas
 */
function detectRoleClothing(sceneDescription: string, characterName: string): string | null {
  const lowerScene = sceneDescription.toLowerCase();
  const lowerName = characterName.toLowerCase();

  // Only apply role clothing if character is mentioned in scene
  if (!lowerScene.includes(lowerName)) {
    return null;
  }

  const rolePatterns: { pattern: RegExp; clothing: string }[] = [
    // EXPLICIT clothing mentions (user wrote about wearing something)
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:christmas|xmas|festive)\s*(?:pajama|pyjama|outfit)/i, clothing: 'cozy Christmas pajamas with festive patterns' },
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:halloween)\s*(?:costume|outfit)/i, clothing: 'fun Halloween costume' },
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:winter|warm)\s*(?:jacket|coat|clothes)/i, clothing: 'warm winter jacket, scarf, and mittens' },
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:rain\s*coat|raincoat)/i, clothing: 'rain coat and rain boots' },
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:swimsuit|bathing\s*suit|swim\s*wear)/i, clothing: 'colorful swimsuit' },
    { pattern: /wear(?:ing|s)?\s+(?:a\s+)?(?:pajama|pyjama|pj)/i, clothing: 'cozy pajamas' },

    // Occupations/Pretend play (explicit "pretend/dress up as")
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:doctor|nurse)/i, clothing: 'white doctor coat with stethoscope' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:superhero|hero)/i, clothing: 'colorful superhero costume with cape' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:chef|cook)/i, clothing: 'chef hat and apron' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:pirate)/i, clothing: 'pirate costume with hat' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:princess|prince)/i, clothing: 'royal costume with crown' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:astronaut)/i, clothing: 'astronaut suit' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:firefighter)/i, clothing: 'firefighter uniform with helmet' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:police|cop)/i, clothing: 'police uniform' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:wizard|witch)/i, clothing: 'wizard robe and hat' },
    { pattern: /(?:pretend|play|dress(?:ed)?(?:\s+up)?).{0,15}(?:as\s+)?(?:a\s+)?(?:fairy)/i, clothing: 'sparkly fairy costume with wings' },

    // Activity-specific (ONLY when activity requires special clothing)
    { pattern: /(?:go(?:ing|es)?\s+)?swim(?:ming)?|in\s+(?:the\s+)?(?:pool|ocean)/i, clothing: 'swimsuit' },
    { pattern: /(?:tak(?:ing|e)\s+)?(?:a\s+)?bath|in\s+(?:the\s+)?(?:bathtub|tub)/i, clothing: 'nothing (bathing)' },
    { pattern: /(?:go(?:ing)?\s+to\s+)?(?:bed|sleep)|bedtime|ready\s+for\s+bed/i, clothing: 'cozy pajamas' },
    { pattern: /(?:at\s+)?ballet\s*(?:class|lesson|practice)/i, clothing: 'ballet outfit with tutu' },
    { pattern: /(?:play(?:ing)?\s+)?(?:soccer|football)\s*(?:game|match|practice)/i, clothing: 'soccer uniform' },
    { pattern: /(?:at\s+)?(?:karate|martial\s*art|taekwondo)\s*(?:class|lesson|practice)/i, clothing: 'martial arts uniform (gi)' },
  ];

  for (const { pattern, clothing } of rolePatterns) {
    if (pattern.test(lowerScene)) {
      return clothing;
    }
  }

  return null;
}

// In-memory cache for outfit consistency across scenes
// Key: character ID or name, Value: outfit description
const outfitCache = new Map<string, string>();

/**
 * Get or set outfit for a character (for consistency across scenes)
 */
function getOrCacheOutfit(characterKey: string, baseOutfit: string | undefined): string {
  // If we already have a cached outfit for this character, use it
  const cached = outfitCache.get(characterKey);
  if (cached) {
    return cached;
  }

  // If character has a base outfit defined, cache and use it
  if (baseOutfit) {
    outfitCache.set(characterKey, baseOutfit);
    return baseOutfit;
  }

  // No outfit defined yet - return empty, AI will pick one
  // The calling code should cache whatever AI generates
  return '';
}

/**
 * Cache an outfit for a character (called after first scene generation)
 */
export function cacheCharacterOutfit(characterKey: string, outfit: string): void {
  outfitCache.set(characterKey, outfit);
}

/**
 * Clear outfit cache (call when starting a new story)
 */
export function clearOutfitCache(): void {
  outfitCache.clear();
}

/**
 * Build smart character prompt with proper type detection and clothing logic
 *
 * When clothingConsistency is 'consistent' (default):
 * - Always use character's base outfit from description.clothing
 * - Skip scene-based role detection (no swimsuits, costumes, etc.)
 * - Ensures same outfit throughout all scenes
 *
 * When clothingConsistency is 'scene-based':
 * - Check for scene-specific explicit costume (user wrote "wearing X")
 * - Falls back to character's base outfit
 * - Allows AI to adapt clothing to scene context
 *
 * NOTE: Theme-based auto clothing was REMOVED
 * We no longer auto-add "winter jacket" for snowy scenes or "pajamas" for Christmas
 * Clothing changes only when user explicitly mentions it in the scene script
 */
function buildSmartCharacterPrompt(
  char: GeminiCharacterInfo,
  sceneDescription: string,
  _storyTheme: string | null,  // kept for API compatibility, but no longer used for clothing
  clothingConsistency: ClothingConsistency = 'consistent'
): { prompt: string; isAnimal: boolean } {
  const { name, description } = char;

  // Get the character description
  const charContext = description.fullDescription || buildMinimalCharacterDescription(name, description);

  // Use isAnimal flag or subjectType to determine if this is a non-human character
  // isAnimal is the legacy flag, subjectType is the new field from AI detection
  // Either being true/non-human means we skip human-specific clothing logic
  const isAnimal = description.isAnimal === true ||
    description.subjectType === 'animal' ||
    description.subjectType === 'creature' ||
    description.subjectType === 'object' ||
    description.subjectType === 'scenery';

  if (isAnimal) {
    // For animals: Use the description as-is, flag as animal for prompt rules
    return {
      prompt: charContext,
      isAnimal: true,
    };
  }

  // Check if character has a reference image (photo-based = human)
  const hasReferenceImage = char.referenceImageUrl && char.referenceImageUrl.trim() !== '';

  // For characters without reference images and not flagged as animals,
  // just use the description as-is (likely a human described via text)
  if (!hasReferenceImage) {
    return {
      prompt: charContext,
      isAnimal: false,
    };
  }

  // For characters WITH reference images (photo-based humans):
  // Apply clothing logic based on clothingConsistency setting

  const characterKey = name.toLowerCase();
  const baseOutfit = description.clothing;

  // CONSISTENT MODE: Always use base outfit, skip scene-based detection
  if (clothingConsistency === 'consistent') {
    const cachedOutfit = getOrCacheOutfit(characterKey, baseOutfit);
    if (cachedOutfit) {
      return {
        prompt: `${charContext}, wearing ${cachedOutfit}`,
        isAnimal: false,
      };
    }
    // No base outfit defined - use description as-is
    // AI should pick something and keep it consistent across scenes
    return {
      prompt: charContext,
      isAnimal: false,
    };
  }

  // SCENE-BASED MODE: Check for scene-specific role clothing first
  const roleClothing = detectRoleClothing(sceneDescription, name);
  if (roleClothing) {
    return {
      prompt: `${charContext}, wearing ${roleClothing} (scene-specific costume)`,
      isAnimal: false,
    };
  }

  // Fall back to base outfit from character description
  const cachedOutfit = getOrCacheOutfit(characterKey, baseOutfit);
  if (cachedOutfit) {
    return {
      prompt: `${charContext}, wearing ${cachedOutfit}`,
      isAnimal: false,
    };
  }

  // No base outfit - use character description as-is
  // AI will pick appropriate clothing based on context
  return {
    prompt: charContext,
    isAnimal: false,
  };
}

/**
 * Generate image with Gemini using actual character reference images
 * Uses new @google/genai SDK with imageConfig for proper 1:1 aspect ratio
 */
export async function generateImageWithGemini({
  characters,
  sceneDescription,
  artStyle = "children's book illustration, colorful, whimsical",
  clothingConsistency = 'consistent',
}: GeminiGenerateParams): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Detect story theme (for logging purposes, not used for auto-clothing anymore)
  const storyTheme = detectStoryTheme(sceneDescription);

  if (storyTheme) {
    console.log(`[Gemini] Detected story theme: ${storyTheme}`);
  }
  console.log(`[Gemini] Clothing consistency mode: ${clothingConsistency}`);

  // Build character descriptions using smart prompt builder
  // Handles: animal detection, clothing priority based on clothingConsistency setting
  const characterPrompts = characters.map(c => {
    const result = buildSmartCharacterPrompt(c, sceneDescription, storyTheme, clothingConsistency);
    console.log(`[Gemini] ${c.name}: ${result.isAnimal ? 'ANIMAL' : 'HUMAN'} - ${result.prompt.substring(0, 80)}...`);
    return { char: c, ...result };
  });

  const characterDescriptions = characterPrompts
    .map(cp => `- ${cp.prompt}`)
    .join('\n');

  // Check if any characters are animals (affects prompt structure)
  const hasAnimalCharacters = characterPrompts.some(cp => cp.isAnimal);
  const hasHumanCharacters = characterPrompts.some(cp => !cp.isAnimal);

  // Check for animals in scene (separate from character animals)
  const hasAnimalsInScene = sceneContainsAnimals(sceneDescription);

  // Build human and animal character sections separately for clearer separation
  const humanCharacters = characterPrompts.filter(cp => !cp.isAnimal);
  const animalCharacters = characterPrompts.filter(cp => cp.isAnimal);

  const humanCharacterSection = humanCharacters.length > 0
    ? `HUMAN CHARACTERS (from reference photos):\n${humanCharacters.map(cp => `- ${cp.char.name} (human child) - ${cp.prompt}`).join('\n')}`
    : '';

  const animalCharacterSection = animalCharacters.length > 0
    ? `ANIMAL CHARACTERS:\n${animalCharacters.map(cp => `- ${cp.prompt} (cute animated animal, animal face, NO human features)`).join('\n')}`
    : '';

  // Detect if scene mentions animals not in character list
  const sceneAnimalSection = hasAnimalsInScene && !hasAnimalCharacters
    ? `ANIMALS IN SCENE:\n- Any animals mentioned in scene: cute cartoon animals with ANIMAL faces, NOT humanoid, NO human clothing`
    : '';

  // Build clothing consistency rule based on setting
  const clothingRule = clothingConsistency === 'consistent'
    ? '- IMPORTANT: Keep character clothing EXACTLY the same as specified in their description. Do NOT change clothing based on scene context, activities, or themes.'
    : '- Keep clothing consistent with character description unless scene specifies costume/role/holiday attire';

  // Build prompt with clear separation between humans and animals
  const fullPrompt = `Create a 3D children's book illustration: ${sceneDescription}

STYLE: 3D animated Pixar/Disney style, soft rounded features, vibrant colors, large expressive eyes. Square 1:1.

PROPORTIONS: Normal, healthy body proportions - not overly fat or chubby. If "big" is mentioned, interpret as LARGE/TALL in size, NOT fat. Maintain natural proportions for the species/character type.

IMPORTANT:
- Generate an ILLUSTRATED 3D animated image, NOT a photograph
- Reference photos show face/hair features only - transform into cute 3D animated characters
- NO religious figures (Jesus, Buddha, etc.)
${(hasAnimalsInScene || hasAnimalCharacters) && hasHumanCharacters ? `- CRITICAL: Human children have HUMAN faces. Animals have ANIMAL faces. NEVER mix - no human-animal hybrids, no human body with animal head, no animal body with human face.` : ''}

${humanCharacterSection}
${animalCharacterSection}
${sceneAnimalSection}

RULES:
${clothingRule}
${(hasAnimalsInScene || hasAnimalCharacters) && hasHumanCharacters ? '- Humans and animals are COMPLETELY SEPARATE entities - each has their own distinct body' : ''}`;

  // Build content parts with images for the new SDK format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  // Add reference images for each character (up to 5 supported by Gemini)
  for (const char of characters.slice(0, 5)) {
    // Only fetch if there's a valid reference image URL
    // Skip: empty URLs, URLs that are just the base localhost, or URLs without actual paths
    const url = char.referenceImageUrl?.trim() || '';
    const isValidImageUrl = url &&
      !url.match(/^https?:\/\/localhost(:\d+)?\/?$/) && // Skip bare localhost URLs
      url.includes('/') && // Must have a path
      url.split('/').pop()?.includes('.'); // Path must have a file extension

    if (isValidImageUrl) {
      try {
        console.log(`[Gemini] Fetching reference image for ${char.name}: ${char.referenceImageUrl}`);
        const imageData = await fetchImageAsBase64(char.referenceImageUrl);

        contentParts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64,
          },
        });
        contentParts.push({ text: `[Reference photo for ${char.name}]` });
      } catch (imgError) {
        console.warn(`[Gemini] Failed to fetch image for ${char.name}:`, imgError);
        // Continue without this reference image
      }
    } else {
      console.log(`[Gemini] No reference image for ${char.name} - using description only`);
    }
  }

  console.log(`[Gemini] Generating with ${characters.length} characters`);
  console.log(`[Gemini] Prompt preview: ${fullPrompt.substring(0, 200)}...`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Gemini 2.5 Flash Image model (Nano Banana) - better quality and character consistency
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square images for consistent display
          },
        },
      });

      // Extract image from response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // Check for text response explaining why no image
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini image generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini] Generated in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        seed: 0, // Gemini doesn't expose seed
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        // Extract retry delay if available
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000; // Default 60s
        const waitTime = Math.min(retryDelay, 120000); // Cap at 2 minutes

        if (attempt < maxRetries) {
          console.warn(`[Gemini] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // For non-rate-limit errors or final attempt, throw immediately
      console.error(`[Gemini] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  // Should not reach here, but just in case
  throw lastError || new Error('Gemini generation failed after all retries');
}

/**
 * Generate image with Gemini in Classic Storybook style (2D illustration)
 *
 * Creates 2D hand-drawn/watercolor style illustrations instead of 3D CGI.
 * Same character consistency but with warm, nostalgic storybook feel.
 * Uses new @google/genai SDK with imageConfig for proper 1:1 aspect ratio
 */
export async function generateImageWithGeminiClassic({
  characters,
  sceneDescription,
  artStyle = "children's book illustration, colorful, whimsical",
  clothingConsistency = 'consistent',
}: GeminiGenerateParams): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Detect story theme (for logging purposes, not used for auto-clothing anymore)
  const storyTheme = detectStoryTheme(sceneDescription);

  if (storyTheme) {
    console.log(`[Gemini Classic] Detected story theme: ${storyTheme}`);
  }
  console.log(`[Gemini Classic] Clothing consistency mode: ${clothingConsistency}`);

  // Build character descriptions using smart prompt builder
  // Handles: animal detection, clothing priority based on clothingConsistency setting
  const characterPrompts = characters.map(c => {
    const result = buildSmartCharacterPrompt(c, sceneDescription, storyTheme, clothingConsistency);
    console.log(`[Gemini Classic] ${c.name}: ${result.isAnimal ? 'ANIMAL' : 'HUMAN'} - ${result.prompt.substring(0, 80)}...`);
    return { char: c, ...result };
  });

  const characterDescriptions = characterPrompts
    .map(cp => `- ${cp.prompt}`)
    .join('\n');

  // Check if any characters are animals (affects prompt structure)
  const hasAnimalCharacters = characterPrompts.some(cp => cp.isAnimal);
  const hasHumanCharacters = characterPrompts.some(cp => !cp.isAnimal);

  // Check for animals in scene (separate from character animals)
  const hasAnimalsInScene = sceneContainsAnimals(sceneDescription);

  // Build human and animal character sections separately for clearer separation
  const humanCharacters = characterPrompts.filter(cp => !cp.isAnimal);
  const animalCharacters = characterPrompts.filter(cp => cp.isAnimal);

  const humanCharacterSection = humanCharacters.length > 0
    ? `HUMAN CHARACTERS (from reference photos):\n${humanCharacters.map(cp => `- ${cp.char.name} (human child) - ${cp.prompt}`).join('\n')}`
    : '';

  const animalCharacterSection = animalCharacters.length > 0
    ? `ANIMAL CHARACTERS:\n${animalCharacters.map(cp => `- ${cp.prompt} (cute 2D illustrated animal, animal face, NO human features)`).join('\n')}`
    : '';

  // Detect if scene mentions animals not in character list
  const sceneAnimalSection = hasAnimalsInScene && !hasAnimalCharacters
    ? `ANIMALS IN SCENE:\n- Any animals mentioned in scene: cute cartoon animals with ANIMAL faces, NOT humanoid, NO human clothing`
    : '';

  // Build clothing consistency rule based on setting
  const clothingRule = clothingConsistency === 'consistent'
    ? '- IMPORTANT: Keep character clothing EXACTLY the same as specified in their description. Do NOT change clothing based on scene context, activities, or themes.'
    : '- Keep clothing consistent with character description unless scene specifies costume/role/holiday attire';

  // Build Classic Storybook style prompt (2D illustration) - Modern vibrant digital style
  const fullPrompt = `Create a 2D children's book illustration: ${sceneDescription}

STYLE: Modern 2D digital cartoon, vibrant saturated colors, smooth cel-shading, large glossy expressive eyes, soft warm lighting, clean polished style. Square 1:1.

PROPORTIONS: Normal, healthy body proportions - not overly fat or chubby. If "big" is mentioned, interpret as LARGE/TALL in size, NOT fat. Maintain natural proportions for the species/character type.

IMPORTANT:
- Generate a DIGITAL ILLUSTRATION, NOT a photograph, NOT watercolor
- Characters MUST closely match reference photos (face shape, skin tone, hair color/style)
- Transform into cute cartoon style while keeping recognizable likeness
- NO religious figures (Jesus, Buddha, etc.)
${(hasAnimalsInScene || hasAnimalCharacters) && hasHumanCharacters ? `- CRITICAL: Human children have HUMAN faces. Animals have ANIMAL faces. NEVER mix - no human-animal hybrids, no human body with animal head, no animal body with human face.` : ''}

${humanCharacterSection}
${animalCharacterSection}
${sceneAnimalSection}

RULES:
${clothingRule}
${(hasAnimalsInScene || hasAnimalCharacters) && hasHumanCharacters ? '- Humans and animals are COMPLETELY SEPARATE entities - each has their own distinct body' : ''}`;

  // Build content parts with images for the new SDK format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  // Add reference images for each character
  for (const char of characters.slice(0, 5)) {
    // Only fetch if there's a valid reference image URL
    // Skip: empty URLs, URLs that are just the base localhost, or URLs without actual paths
    const url = char.referenceImageUrl?.trim() || '';
    const isValidImageUrl = url &&
      !url.match(/^https?:\/\/localhost(:\d+)?\/?$/) && // Skip bare localhost URLs
      url.includes('/') && // Must have a path
      url.split('/').pop()?.includes('.'); // Path must have a file extension

    if (isValidImageUrl) {
      try {
        console.log(`[Gemini Classic] Fetching reference image for ${char.name}: ${char.referenceImageUrl}`);
        const imageData = await fetchImageAsBase64(char.referenceImageUrl);

        contentParts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64,
          },
        });
        contentParts.push({ text: `[Reference photo for ${char.name}]` });
      } catch (imgError) {
        console.warn(`[Gemini Classic] Failed to fetch image for ${char.name}:`, imgError);
      }
    } else {
      console.log(`[Gemini Classic] No reference image for ${char.name} - using description only`);
    }
  }

  console.log(`[Gemini Classic] Generating with ${characters.length} characters`);
  console.log(`[Gemini Classic] Prompt preview: ${fullPrompt.substring(0, 200)}...`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Gemini 2.5 Flash Image model (Nano Banana) - better quality and character consistency
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square images for consistent display
          },
        },
      });

      // Extract image from response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini Classic image generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Classic] Generated in ${generationTime.toFixed(1)}s`);

      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        seed: 0,
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini Classic] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini Classic] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini Classic generation failed after all retries');
}

/**
 * Check if Gemini is available (API key configured)
 */
export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ============================================================================
// SUBJECT TYPE DETECTION
// ============================================================================

/**
 * Result from subject type detection
 */
export interface SubjectDetectionResult {
  subjectType: SubjectType;
  briefDescription: string;
  confidence: number; // 0-1
}

/**
 * Detect the subject type from an uploaded image using Gemini Vision
 *
 * This analyzes the image to determine if it contains:
 * - 'human': Real person, child, adult (from photo)
 * - 'animal': Real animals (dog, cat, bird)
 * - 'creature': Fantasy beings (dragon, unicorn, monster), cartoon characters
 * - 'object': Inanimate items (toy, sword, car)
 * - 'scenery': Backgrounds/places (house, castle, tree)
 *
 * Used to branch preview generation prompts appropriately.
 */
export async function detectSubjectType(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<SubjectDetectionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenAI({ apiKey });

  const detectionPrompt = `Analyze this image and identify the main subject.

Return ONLY a JSON object (no markdown, no code blocks, just raw JSON):
{
  "subjectType": "human" | "animal" | "creature" | "object" | "scenery",
  "briefDescription": "short description of key visual features (10-20 words)",
  "confidence": 0.0 to 1.0
}

Classification guidelines:
- "human": Real person (child, adult, baby) from a photograph. Includes stylized portraits that are clearly meant to represent a real person.
- "animal": Real-world animals (dog, cat, bird, fish, elephant). Both photos and drawings of real animals.
- "creature": Fantasy/imaginary beings (dragon, unicorn, monster, alien), cartoon characters, anthropomorphic characters, magical beings.
- "object": Inanimate items (toy, sword, car, ball, book, food). Things that don't move on their own.
- "scenery": Backgrounds, places, buildings (house, castle, tree, mountain, landscape, room).

For children's drawings: Interpret what the drawing REPRESENTS, not that it's "a drawing". A child's drawing of a dragon is "creature", not "object".

If multiple subjects exist, classify based on the MAIN/PRIMARY subject.
If the image shows a person with a pet, classify as "human" (the person is primary).
If the image shows only scenery with small figures, classify as "scenery".`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash', // Use fast model for detection (no image generation needed)
      contents: [
        { text: detectionPrompt },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
    });

    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.warn('[Gemini Detection] No candidates in response, defaulting to human');
      return { subjectType: 'human', briefDescription: 'Unable to detect', confidence: 0.5 };
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      console.warn('[Gemini Detection] No parts in response, defaulting to human');
      return { subjectType: 'human', briefDescription: 'Unable to detect', confidence: 0.5 };
    }

    // Find the text part with the JSON response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.text);
    if (!textPart?.text) {
      console.warn('[Gemini Detection] No text in response, defaulting to human');
      return { subjectType: 'human', briefDescription: 'Unable to detect', confidence: 0.5 };
    }

    // Parse the JSON response (handle potential markdown code blocks)
    let jsonText = textPart.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);

    // Validate the response
    const validTypes: SubjectType[] = ['human', 'animal', 'creature', 'object', 'scenery'];
    if (!validTypes.includes(parsed.subjectType)) {
      console.warn(`[Gemini Detection] Invalid subject type "${parsed.subjectType}", defaulting to human`);
      return { subjectType: 'human', briefDescription: parsed.briefDescription || 'Unknown', confidence: 0.5 };
    }

    console.log(`[Gemini Detection] Detected: ${parsed.subjectType} - ${parsed.briefDescription} (confidence: ${parsed.confidence})`);

    return {
      subjectType: parsed.subjectType as SubjectType,
      briefDescription: parsed.briefDescription || '',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
    };
  } catch (error) {
    console.error('[Gemini Detection] Error detecting subject type:', error);
    // Default to human for backwards compatibility
    return { subjectType: 'human', briefDescription: 'Detection failed', confidence: 0.5 };
  }
}

// ============================================================================
// UNIFIED CHARACTER IMAGE ANALYSIS (Option 3)
// ============================================================================

/**
 * Result from unified character image analysis
 * Contains either human-specific structured fields OR non-human description
 */
export interface CharacterAnalysisResult {
  subjectType: SubjectType;
  confidence: number;
  // For humans: structured fields
  humanDetails?: {
    gender: string;      // boy, girl, man, woman, baby, etc.
    hairColor: string;
    skinTone: string;
    age: string;
    clothing: string;
    otherFeatures: string;
  };
  // For non-humans: description text
  briefDescription?: string;
}

/**
 * Unified character image analysis using Gemini Vision
 *
 * This is the single-call solution that:
 * 1. Detects subject type (human vs non-human)
 * 2. Returns appropriate data based on type:
 *    - Human: Structured fields (gender, hair, skin, age, clothing, features)
 *    - Non-human: Brief description text
 *
 * Benefits over previous GPT+Gemini approach:
 * - Single API call (~1-2s vs ~3-5s)
 * - No fragile fallback logic
 * - Consistent AI model for all analysis
 */
export async function analyzeCharacterImage(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<CharacterAnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenAI({ apiKey });

  const analysisPrompt = `Analyze this image and extract character information for a children's storybook.

STEP 1: Determine the subject type:
- "human": Real person from a photograph (child, adult, baby)
- "animal": Real-world animals (dog, cat, bird, fish)
- "creature": Fantasy/cartoon beings (dragon, unicorn, monster, cartoon character)
- "object": Inanimate items (toy, sword, car)
- "scenery": Backgrounds, places, buildings

STEP 2: Based on subject type, return the appropriate JSON:

IF HUMAN, return:
{
  "subjectType": "human",
  "confidence": 0.0 to 1.0,
  "humanDetails": {
    "gender": "boy/girl/man/woman/baby boy/baby girl/toddler",
    "hairColor": "description of hair color and style",
    "skinTone": "description of skin tone",
    "age": "approximate age or age range",
    "clothing": "description of visible clothing",
    "otherFeatures": "notable features like glasses, freckles, dimples"
  }
}

IF NOT HUMAN (animal, creature, object, scenery), return:
{
  "subjectType": "animal" | "creature" | "object" | "scenery",
  "confidence": 0.0 to 1.0,
  "briefDescription": "detailed visual description (15-30 words) including colors, features, style"
}

Important guidelines:
- For children's drawings: Identify what the drawing REPRESENTS (a dragon drawing = "creature")
- Be specific and descriptive for storybook character consistency
- For gender: Use child-friendly terms (boy, girl) for children; man, woman for adults
- Return ONLY raw JSON, no markdown code blocks

Return the JSON now:`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { text: analysisPrompt },
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
      ],
    });

    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.warn('[Gemini Analysis] No candidates in response, defaulting to human');
      return {
        subjectType: 'human',
        confidence: 0.5,
        humanDetails: {
          gender: '',
          hairColor: '',
          skinTone: '',
          age: '',
          clothing: '',
          otherFeatures: 'Unable to analyze automatically',
        },
      };
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      console.warn('[Gemini Analysis] No parts in response');
      return {
        subjectType: 'human',
        confidence: 0.5,
        humanDetails: {
          gender: '',
          hairColor: '',
          skinTone: '',
          age: '',
          clothing: '',
          otherFeatures: 'Unable to analyze automatically',
        },
      };
    }

    // Find the text part with the JSON response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.text);
    if (!textPart?.text) {
      console.warn('[Gemini Analysis] No text in response');
      return {
        subjectType: 'human',
        confidence: 0.5,
        humanDetails: {
          gender: '',
          hairColor: '',
          skinTone: '',
          age: '',
          clothing: '',
          otherFeatures: 'Unable to analyze automatically',
        },
      };
    }

    // Parse the JSON response (handle potential markdown code blocks)
    let jsonText = textPart.text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.slice(7);
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.slice(3);
    }
    if (jsonText.endsWith('```')) {
      jsonText = jsonText.slice(0, -3);
    }
    jsonText = jsonText.trim();

    const parsed = JSON.parse(jsonText);

    // Validate subject type
    const validTypes: SubjectType[] = ['human', 'animal', 'creature', 'object', 'scenery'];
    const subjectType = validTypes.includes(parsed.subjectType) ? parsed.subjectType : 'human';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;

    if (subjectType === 'human') {
      // Human: return structured fields
      const details = parsed.humanDetails || {};
      console.log(`[Gemini Analysis] Human detected: ${details.gender || 'unknown'}, ${details.age || 'unknown age'}`);
      return {
        subjectType: 'human',
        confidence,
        humanDetails: {
          gender: details.gender || '',
          hairColor: details.hairColor || '',
          skinTone: details.skinTone || '',
          age: details.age || '',
          clothing: details.clothing || '',
          otherFeatures: details.otherFeatures || '',
        },
      };
    } else {
      // Non-human: return description
      console.log(`[Gemini Analysis] Non-human detected: ${subjectType} - ${parsed.briefDescription || ''}`);
      return {
        subjectType,
        confidence,
        briefDescription: parsed.briefDescription || `${subjectType} character`,
      };
    }
  } catch (error) {
    console.error('[Gemini Analysis] Error analyzing character image:', error);
    // Default to human with empty fields
    return {
      subjectType: 'human',
      confidence: 0.5,
      humanDetails: {
        gender: '',
        hairColor: '',
        skinTone: '',
        age: '',
        clothing: '',
        otherFeatures: 'Analysis failed - please enter details manually',
      },
    };
  }
}

/**
 * Check if a subject type represents a living/acting entity
 * (as opposed to objects or scenery which don't "act" in stories)
 */
export function isActorSubjectType(subjectType: SubjectType | undefined): boolean {
  if (!subjectType) return true; // Default to actor for backwards compatibility
  return ['human', 'animal', 'creature'].includes(subjectType);
}

/**
 * Check if a subject type should use human-specific prompts
 * (preserve face, hair, skin tone, etc.)
 */
export function isHumanSubjectType(subjectType: SubjectType | undefined): boolean {
  return !subjectType || subjectType === 'human';
}

// ============================================================================
// CHARACTER PREVIEW GENERATION
// ============================================================================

/**
 * Character Preview Generation Parameters
 */
export interface CharacterPreviewParams {
  name: string;
  referenceImageUrl: string;
  description: CharacterDescription;
}

export interface CharacterPreviewResult {
  imageUrl: string; // data URL (base64)
  generationTime: number;
  prompt: string;
}

/**
 * Generate a character preview image (portrait style)
 *
 * This creates a single portrait-style image of the character in 3D Pixar style.
 * Used for character library to show users how their character will appear in stories.
 * Uses new @google/genai SDK with imageConfig for proper 1:1 aspect ratio
 */
export async function generateCharacterPreview({
  name,
  referenceImageUrl,
  description,
}: CharacterPreviewParams): Promise<CharacterPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Build minimal character description as fallback
  const charDesc = buildMinimalCharacterDescription(name, description);

  // Check if description mentions chubby/plump/round body type
  const hasChubbyDescription = description ?
    /\b(chubby|plump|round|fat|chunky|pudgy|stocky|big)\b/i.test(description) : false;

  // Portrait-focused prompt for character preview
  const fullPrompt = `Create a 3D animated character portrait showing: ${name}

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Render as a 3D ANIMATED/ILLUSTRATED character (Pixar/Disney Junior style)
- Do NOT paste or photoshop the reference photo - create an ANIMATED version
- Do NOT create realistic/photographic faces - everything must be stylized illustration
- Use the reference photo ONLY to understand: face shape, skin tone, hair color/style, and key features
- Then DRAW the character in 3D animated style with those features
- Output should look like a character from an animated movie, NOT a photo edit

=== ART STYLE ===
- 3D rendered character portrait (like Pixar, Disney Junior, Cocomelon)
- ${hasChubbyDescription ? 'Soft, rounded features' : 'Balanced, well-proportioned face and body with normal features'} with warm, flattering lighting
- Vibrant, cheerful colors
- Smooth skin textures (not photorealistic)
- Large expressive eyes typical of animation
- Friendly, approachable expression (gentle smile)
- Clean background (soft gradient or simple solid color)
- Head and shoulders composition (portrait style)

=== CHARACTER ===
- ${charDesc}
- Use the reference photo as PRIMARY source for identity
- Text description is FALLBACK only

=== CHARACTER RULES ===
1. PHOTO IS PRIMARY: Use the reference photo to capture the character's identity
2. Skin tone: MUST match reference photo exactly
3. Hair: Match color and general style from reference photo
4. Face: Recognizable from photo but stylized for 3D animation
5. Clothing: Simple, neutral casual clothes (this is just a portrait preview)
6. Expression: Friendly, happy, approachable
7. ${hasChubbyDescription ? 'Character has a chubby/plump body as described' : 'IMPORTANT: Use normal, balanced proportions - avoid making the face/body overly round or chubby unless specified in description'}

This is a CHARACTER PREVIEW for a children's storybook app. The character should look appealing and kid-friendly.`;

  // Build content parts with the reference image for the new SDK format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  try {
    console.log(`[Gemini Preview] Fetching reference image for ${name}: ${referenceImageUrl}`);
    const imageData = await fetchImageAsBase64(referenceImageUrl);

    contentParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    });
    contentParts.push({ text: `[Reference photo for ${name}]` });
  } catch (imgError) {
    console.error(`[Gemini Preview] Failed to fetch image for ${name}:`, imgError);
    throw new Error(`Failed to fetch reference image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`);
  }

  console.log(`[Gemini Preview] Generating portrait for ${name}`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Gemini 2.5 Flash Image model (Nano Banana) - better quality and character consistency
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Preview] Generated portrait for ${name} in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini Preview] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini Preview] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini preview generation failed after all retries');
}

/**
 * Generate a character preview in Classic Storybook style (2D)
 *
 * This creates a 2D illustrated portrait with soft watercolor feel,
 * warm golden lighting, and dreamy storybook atmosphere.
 * Uses new @google/genai SDK with imageConfig for proper 1:1 aspect ratio
 */
export async function generateCharacterPreviewClassic({
  name,
  referenceImageUrl,
  description,
}: CharacterPreviewParams): Promise<CharacterPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Build minimal character description as fallback
  const charDesc = buildMinimalCharacterDescription(name, description);

  // Classic Storybook style prompt - 2D, warm, watercolor feel
  const fullPrompt = `Create a 2D illustrated character portrait showing: ${name}

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Render as a 2D HAND-DRAWN/DIGITAL ILLUSTRATION (NOT 3D CGI)
- Style: Classic children's storybook illustration, anime-inspired chibi proportions
- Do NOT create 3D rendered or CGI style - this must look hand-drawn/painted
- Use the reference photo ONLY to understand: face shape, skin tone, hair color/style, and key features
- Then ILLUSTRATE the character in 2D storybook style with those features
- Output should look like a page from a classic children's picture book

=== ART STYLE ===
- 2D digital illustration with soft watercolor/painted feel
- Warm golden hour lighting with soft bokeh background
- Pastel, muted color palette with gentle saturation
- Large expressive eyes (anime/chibi inspired)
- Soft edges and dreamy atmosphere
- Hand-drawn quality, not computer generated look
- Nostalgic, cozy, heartwarming feeling
- Clean soft gradient or nature background (forest, meadow with soft blur)
- Head and shoulders composition (portrait style)

=== CHARACTER ===
- ${charDesc}
- Use the reference photo as PRIMARY source for identity
- Text description is FALLBACK only

=== CHARACTER RULES ===
1. PHOTO IS PRIMARY: Use the reference photo to capture the character's identity
2. Skin tone: MUST match reference photo exactly (rendered in illustrated style)
3. Hair: Match color and general style from reference photo
4. Face: Recognizable from photo but stylized for 2D illustration
5. Clothing: Simple, casual clothes in warm, friendly colors
6. Expression: Friendly, happy, gentle smile
7. MUST BE 2D ILLUSTRATED - not 3D rendered

This is a CHARACTER PREVIEW for a children's storybook app. The style should feel warm, nostalgic, and like a classic children's book illustration.`;

  // Build content parts with the reference image for the new SDK format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  try {
    console.log(`[Gemini Classic] Fetching reference image for ${name}: ${referenceImageUrl}`);
    const imageData = await fetchImageAsBase64(referenceImageUrl);

    contentParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    });
    contentParts.push({ text: `[Reference photo for ${name}]` });
  } catch (imgError) {
    console.error(`[Gemini Classic] Failed to fetch image for ${name}:`, imgError);
    throw new Error(`Failed to fetch reference image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`);
  }

  console.log(`[Gemini Classic] Generating portrait for ${name}`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use Gemini 2.5 Flash Image model (Nano Banana) - better quality and character consistency
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini classic preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Classic] Generated portrait for ${name} in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini Classic] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini Classic] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini classic preview generation failed after all retries');
}

// ============================================================================
// NON-HUMAN IMAGE-BASED PREVIEW GENERATION
// ============================================================================

/**
 * Parameters for non-human image-based character generation
 * Used when AI detects the uploaded image is NOT a human (animal, creature, object, scenery)
 */
export interface NonHumanPreviewParams {
  name: string;
  referenceImageUrl: string;
  subjectType: SubjectType; // 'animal' | 'creature' | 'object' | 'scenery'
  briefDescription: string; // AI-detected description of key features
  additionalDetails?: string; // User-provided additional details
}

export interface NonHumanPreviewResult {
  imageUrl: string; // data URL (base64)
  generationTime: number;
  prompt: string;
  subjectType: SubjectType;
}

/**
 * Generate a preview for non-human subjects (Pixar 3D style)
 *
 * This creates an animated version of the uploaded image (drawing, animal photo, etc.)
 * preserving the key visual characteristics while transforming to Pixar style.
 */
export async function generateNonHumanPreview({
  name,
  referenceImageUrl,
  subjectType,
  briefDescription,
  additionalDetails,
}: NonHumanPreviewParams): Promise<NonHumanPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();
  const genAI = new GoogleGenAI({ apiKey });

  // Build subject-specific rules
  const subjectRules = getSubjectSpecificRules(subjectType);

  // Check if description mentions chubby/plump/round body type
  const hasChubbyDescription = additionalDetails ?
    /\b(chubby|plump|round|fat|chunky|pudgy|stocky|big)\b/i.test(additionalDetails) : false;

  // Build the prompt for non-human subjects
  const fullPrompt = `Create a 3D animated illustration of the subject in this reference image.

=== SUBJECT INFORMATION ===
- Name: ${name}
- Type: ${subjectType} (${briefDescription})
${additionalDetails ? `- Additional details: ${additionalDetails}` : ''}

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Transform the reference image into a 3D ANIMATED/ILLUSTRATED version (Pixar/Disney style)
- Do NOT just copy the reference - CREATE an animated interpretation
- The output should look like a character/element from an animated movie
- Style: Modern 3D animation like Pixar, Disney Junior, or Cocomelon

=== ART STYLE ===
- 3D rendered illustration (like Pixar, Disney Junior, Cocomelon)
- ${hasChubbyDescription ? 'Soft, rounded features' : 'Balanced, well-proportioned body with normal features'} with warm, flattering lighting
- Vibrant, cheerful colors
- Large expressive features typical of animation
- Friendly, approachable appearance
- Clean background (soft gradient or simple solid color)
- Portrait/centered composition

=== PRESERVATION RULES ===
1. Keep the SAME colors from the reference (if it's purple, stay purple)
2. Keep distinctive features (wings, horns, shape, patterns)
3. Keep the mood/personality (friendly, scary, cute, majestic)
4. Make it suitable for children's storybook
5. ${hasChubbyDescription ? 'Character has a chubby/plump body as described' : 'IMPORTANT: Use normal, balanced proportions - avoid making overly round or chubby unless specified'}
${subjectRules}

=== DO NOT ===
- Make it photorealistic
- Change the fundamental nature of the subject
- Add human features to non-human subjects
- Make it scary or inappropriate for children
- ${!hasChubbyDescription ? 'Make the character overly round, chubby, or excessively plump' : ''}

This is for a children's storybook app. The result should be appealing, memorable, and kid-friendly.`;

  // Build content parts with the reference image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  try {
    console.log(`[Gemini NonHuman Preview] Fetching reference image for ${name}: ${referenceImageUrl}`);
    const imageData = await fetchImageAsBase64(referenceImageUrl);

    contentParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    });
    contentParts.push({ text: `[Reference image for ${name}]` });
  } catch (imgError) {
    console.error(`[Gemini NonHuman Preview] Failed to fetch image for ${name}:`, imgError);
    throw new Error(`Failed to fetch reference image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`);
  }

  console.log(`[Gemini NonHuman Preview] Generating ${subjectType} portrait for ${name}`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini NonHuman Preview] Generated ${subjectType} portrait for ${name} in ${generationTime.toFixed(1)}s`);

      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
        subjectType,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini NonHuman Preview] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini NonHuman Preview] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini non-human preview generation failed after all retries');
}

/**
 * Generate a preview for non-human subjects (Classic 2D style)
 */
export async function generateNonHumanPreviewClassic({
  name,
  referenceImageUrl,
  subjectType,
  briefDescription,
  additionalDetails,
}: NonHumanPreviewParams): Promise<NonHumanPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();
  const genAI = new GoogleGenAI({ apiKey });

  // Build subject-specific rules
  const subjectRules = getSubjectSpecificRules(subjectType);

  // Build the prompt for non-human subjects in classic 2D style
  const fullPrompt = `Create a 2D illustrated version of the subject in this reference image.

=== SUBJECT INFORMATION ===
- Name: ${name}
- Type: ${subjectType} (${briefDescription})
${additionalDetails ? `- Additional details: ${additionalDetails}` : ''}

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Transform the reference image into a 2D HAND-DRAWN/DIGITAL ILLUSTRATION
- Do NOT create 3D rendered or CGI style - this must look hand-drawn/painted
- Style: Classic children's storybook illustration with soft watercolor/painted feel
- Do NOT just copy the reference - CREATE an illustrated interpretation

=== ART STYLE ===
- 2D digital illustration with soft watercolor/painted feel
- Warm golden hour lighting with soft bokeh background
- Pastel, muted color palette with gentle saturation
- Large expressive features (anime/chibi inspired proportions where appropriate)
- Soft edges and dreamy atmosphere
- Hand-drawn quality, not computer generated look
- Nostalgic, cozy, heartwarming feeling
- Clean soft gradient or nature background
- Portrait/centered composition

=== PRESERVATION RULES ===
1. Keep the SAME colors from the reference (if it's purple, stay purple)
2. Keep distinctive features (wings, horns, shape, patterns)
3. Keep the mood/personality (friendly, scary, cute, majestic)
4. Make it suitable for children's storybook
${subjectRules}

=== DO NOT ===
- Make it photorealistic or 3D rendered
- Change the fundamental nature of the subject
- Add human features to non-human subjects
- Make it scary or inappropriate for children

This is for a children's storybook app. The result should be appealing, memorable, and kid-friendly.`;

  // Build content parts with the reference image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  try {
    console.log(`[Gemini NonHuman Classic] Fetching reference image for ${name}: ${referenceImageUrl}`);
    const imageData = await fetchImageAsBase64(referenceImageUrl);

    contentParts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    });
    contentParts.push({ text: `[Reference image for ${name}]` });
  } catch (imgError) {
    console.error(`[Gemini NonHuman Classic] Failed to fetch image for ${name}:`, imgError);
    throw new Error(`Failed to fetch reference image: ${imgError instanceof Error ? imgError.message : 'Unknown error'}`);
  }

  console.log(`[Gemini NonHuman Classic] Generating ${subjectType} portrait for ${name}`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini classic preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini NonHuman Classic] Generated ${subjectType} portrait for ${name} in ${generationTime.toFixed(1)}s`);

      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
        subjectType,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini NonHuman Classic] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini NonHuman Classic] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini non-human classic preview generation failed after all retries');
}

/**
 * Get subject-type specific rules for prompt generation
 */
function getSubjectSpecificRules(subjectType: SubjectType): string {
  switch (subjectType) {
    case 'animal':
      return `
5. For ANIMALS: Keep natural animal features, NO human clothing unless the reference shows it
6. Maintain the animal's natural proportions and species characteristics`;

    case 'creature':
      return `
5. For CREATURES/FANTASY: Embrace the magical/fantastical nature
6. Keep any special features (wings, horns, magical elements)
7. Make it whimsical and appealing for children`;

    case 'object':
      return `
5. For OBJECTS: Can add personality through expression if appropriate (like Pixar's lamp)
6. Keep the object recognizable but stylized
7. Add warmth and appeal typical of animated objects`;

    case 'scenery':
      return `
5. For SCENERY: Maintain the location/building's character
6. Add warmth and whimsy (like houses in Up or Howl's Moving Castle)
7. Keep architectural features but stylize them`;

    default:
      return '';
  }
}

// ============================================================================
// DESCRIPTION-ONLY CHARACTER GENERATION
// ============================================================================

/**
 * Parameters for description-only character generation (no reference image)
 * Used for animal characters, fantasy characters, or when no photo is available
 */
export interface DescriptionOnlyPreviewParams {
  name: string;
  characterType: string; // e.g., "baby eagle", "friendly dragon", "talking cat"
  description: string; // Additional description like "fluffy feathers, big curious eyes"
}

export interface DescriptionOnlyPreviewResult {
  imageUrl: string; // data URL (base64)
  generationTime: number;
  prompt: string;
}

/**
 * Generate a character preview from description only (no reference image)
 * 3D Pixar style - for animals, fantasy creatures, or characters without photos
 */
export async function generateDescriptionOnlyPreview({
  name,
  characterType,
  description,
}: DescriptionOnlyPreviewParams): Promise<DescriptionOnlyPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Check if description mentions chubby/plump/round body type
  const hasChubbyDescription = description ?
    /\b(chubby|plump|round|fat|chunky|pudgy|stocky|big)\b/i.test(description) : false;

  // Build description-based prompt for 3D style
  const fullPrompt = `Create a 3D animated character portrait showing: ${name} (a ${characterType})

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Render as a 3D ANIMATED/ILLUSTRATED character (Pixar/Disney Junior style)
- This is a ${characterType} character - create a cute, appealing animated version
- Style: Modern 3D animation like Pixar, Disney Junior, or Cocomelon
- The character should be expressive, friendly, and kid-appropriate

=== ART STYLE ===
- 3D rendered character portrait (like Pixar, Disney Junior, Cocomelon)
- ${hasChubbyDescription ? 'Soft, rounded features' : 'Balanced, well-proportioned body with normal features'} with warm, flattering lighting
- Vibrant, cheerful colors
- Smooth textures (stylized, not photorealistic)
- Large expressive eyes typical of animation
- Friendly, approachable expression (gentle smile or curious look)
- Clean background (soft gradient or simple solid color)
- Head/upper body composition (portrait style)

=== CHARACTER DETAILS ===
- Name: ${name}
- Type: ${characterType}
- Additional details: ${description || 'cute and friendly appearance'}

=== CHARACTER RULES ===
1. Make the character appealing and kid-friendly
2. Use the character type description to determine species/form
3. Add personality through expression and pose
4. Keep colors vibrant and cheerful
5. Expression: Friendly, happy, approachable
6. ${hasChubbyDescription ? 'Character has a chubby/plump body as described' : 'IMPORTANT: Use normal, balanced proportions - avoid making the character overly round or chubby unless specified in description'}

This is a CHARACTER PREVIEW for a children's storybook app. The character should look appealing, memorable, and perfect for children's stories.`;

  // Build content parts (text only - no reference image)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  console.log(`[Gemini Preview] Generating description-only portrait for ${name} (${characterType})`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Preview] Generated description-only portrait for ${name} in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini Preview] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini Preview] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini description-only preview generation failed after all retries');
}

/**
 * Generate a character preview from description only - Classic 2D Storybook style
 * Used for animal characters, fantasy creatures, or characters without photos
 */
export async function generateDescriptionOnlyPreviewClassic({
  name,
  characterType,
  description,
}: DescriptionOnlyPreviewParams): Promise<DescriptionOnlyPreviewResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Check if description mentions chubby/plump/round body type
  const hasChubbyDescription = description ?
    /\b(chubby|plump|round|fat|chunky|pudgy|stocky|big)\b/i.test(description) : false;

  // Build description-based prompt for Classic 2D style
  const fullPrompt = `Create a 2D illustrated character portrait showing: ${name} (a ${characterType})

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Render as a 2D HAND-DRAWN/DIGITAL ILLUSTRATION (NOT 3D CGI)
- This is a ${characterType} character - create a cute, appealing illustrated version
- Style: Classic children's storybook illustration with soft watercolor/painted feel
- Do NOT create 3D rendered or CGI style - this must look hand-drawn/painted

=== ART STYLE ===
- 2D digital illustration with soft watercolor/painted feel
- Warm golden hour lighting with soft bokeh background
- Pastel, muted color palette with gentle saturation
- Large expressive eyes (anime/chibi inspired proportions)
- ${hasChubbyDescription ? 'Soft, rounded body shape' : 'Balanced, well-proportioned body with normal features'}
- Soft edges and dreamy atmosphere
- Hand-drawn quality, not computer generated look
- Nostalgic, cozy, heartwarming feeling
- Clean soft gradient or nature background (forest, meadow with soft blur)
- Head/upper body composition (portrait style)

=== CHARACTER DETAILS ===
- Name: ${name}
- Type: ${characterType}
- Additional details: ${description || 'cute and friendly appearance'}

=== CHARACTER RULES ===
1. Make the character appealing and kid-friendly
2. Use the character type description to determine species/form
3. Add personality through expression and pose
4. Keep colors warm and gentle (watercolor feel)
5. Expression: Friendly, happy, gentle
6. MUST BE 2D ILLUSTRATED - not 3D rendered
7. ${hasChubbyDescription ? 'Character has a chubby/plump body as described' : 'IMPORTANT: Use normal, balanced proportions - avoid making the character overly round or chubby unless specified in description'}

This is a CHARACTER PREVIEW for a children's storybook app. The style should feel warm, nostalgic, and like a classic children's book illustration.`;

  // Build content parts (text only - no reference image)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [{ text: fullPrompt }];

  console.log(`[Gemini Classic] Generating description-only portrait for ${name} (${characterType})`);

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square portrait images
          },
        },
      });

      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini classic preview generation failed: ${textPart?.text || 'No image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Classic] Generated description-only portrait for ${name} in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        prompt: fullPrompt,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000;
        const waitTime = Math.min(retryDelay, 120000);

        if (attempt < maxRetries) {
          console.warn(`[Gemini Classic] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      console.error(`[Gemini Classic] Generation error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini classic description-only preview generation failed after all retries');
}

// ============================================================================
// IMAGE EDITING
// ============================================================================

/**
 * Parameters for editing an existing image with Gemini
 */
export interface GeminiEditParams {
  /** URL of the current image to edit */
  currentImageUrl: string;
  /** Natural language instruction for the edit (e.g., "remove the cat", "add a tree") */
  editInstruction: string;
  /** Original scene description for context */
  sceneDescription?: string;
  /** Illustration style to maintain */
  illustrationStyle?: 'pixar' | 'classic';
}

/**
 * Result from image editing
 */
export interface GeminiEditResult {
  imageUrl: string; // data URL (base64)
  generationTime: number;
  editInstruction: string;
}

/**
 * Edit an existing image using Gemini's text-guided image editing
 *
 * Gemini can modify an existing image based on natural language instructions
 * while maintaining the overall style and character consistency.
 *
 * @example
 * ```typescript
 * const result = await editImageWithGemini({
 *   currentImageUrl: 'https://...',
 *   editInstruction: 'remove the cat in the background',
 *   sceneDescription: 'A child playing in a garden',
 *   illustrationStyle: 'pixar',
 * });
 * ```
 */
export async function editImageWithGemini({
  currentImageUrl,
  editInstruction,
  sceneDescription,
  illustrationStyle = 'pixar',
}: GeminiEditParams): Promise<GeminiEditResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  if (!currentImageUrl) {
    throw new Error('Current image URL is required for editing');
  }

  if (!editInstruction || editInstruction.trim().length < 3) {
    throw new Error('Edit instruction must be at least 3 characters');
  }

  const startTime = Date.now();
  const genAI = new GoogleGenAI({ apiKey });

  // Build the edit prompt based on illustration style
  const styleDescription = illustrationStyle === 'pixar'
    ? '3D animated Pixar/Disney style with soft rounded features, vibrant colors, large expressive eyes'
    : 'Modern 2D digital cartoon with vibrant saturated colors, smooth cel-shading, large glossy expressive eyes';

  // Construct the edit prompt
  const editPrompt = `Edit this children's book illustration with the following change:

EDIT REQUEST: ${editInstruction}

${sceneDescription ? `SCENE CONTEXT: ${sceneDescription}` : ''}

STYLE TO MAINTAIN: ${styleDescription}

PROPORTIONS TO MAINTAIN: Normal, healthy body proportions - not overly fat or chubby. If "big" is mentioned, interpret as LARGE/TALL in size, NOT fat. Maintain natural proportions for the species/character type.

IMPORTANT RULES:
- Apply ONLY the requested edit
- Keep the same illustration style (${illustrationStyle === 'pixar' ? '3D Pixar' : '2D cartoon'})
- Preserve character appearances and expressions unless specifically asked to change them
- Maintain the same color palette and lighting
- Keep the same background unless specifically asked to change it
- Output must be a children's book illustration, NOT a photograph
- Square 1:1 aspect ratio`;

  console.log(`[Gemini Edit] Editing image with instruction: "${editInstruction}"`);
  console.log(`[Gemini Edit] Style: ${illustrationStyle}, Scene: ${sceneDescription?.substring(0, 50) || 'N/A'}...`);

  // Fetch the current image as base64
  let imageData: { base64: string; mimeType: string };
  try {
    imageData = await fetchImageAsBase64(currentImageUrl);
    console.log(`[Gemini Edit] Fetched current image (${imageData.mimeType})`);
  } catch (fetchError) {
    console.error('[Gemini Edit] Failed to fetch current image:', fetchError);
    throw new Error(`Failed to fetch current image for editing: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`);
  }

  // Build content parts: text prompt + current image
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentParts: any[] = [
    { text: editPrompt },
    {
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    },
    { text: '[Image to edit - apply the requested changes while maintaining style]' },
  ];

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await genAI.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contentParts,
        config: {
          responseModalities: [Modality.TEXT, Modality.IMAGE],
          imageConfig: {
            aspectRatio: '1:1', // Square images for consistent display
          },
        },
      });

      // Extract image from response
      const candidates = result.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini edit response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in Gemini edit response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // Check for text response explaining why no image
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        throw new Error(`Gemini edit failed: ${textPart?.text || 'No edited image generated'}`);
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Gemini Edit] Edited image in ${generationTime.toFixed(1)}s`);

      // Return as data URL
      const imageDataUrl = `data:${imagePart.inlineData.mimeType || 'image/png'};base64,${imagePart.inlineData.data}`;

      return {
        imageUrl: imageDataUrl,
        generationTime,
        editInstruction,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a rate limit error (429)
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        const retryMatch = errorMessage.match(/retry in (\d+)/i);
        const retryDelay = retryMatch ? parseInt(retryMatch[1], 10) * 1000 : 60000; // Default 60s
        const waitTime = Math.min(retryDelay, 120000); // Cap at 2 minutes

        if (attempt < maxRetries) {
          console.warn(`[Gemini Edit] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // For non-rate-limit errors or final attempt, throw
      console.error(`[Gemini Edit] Error (attempt ${attempt}/${maxRetries}):`, error);
      if (attempt === maxRetries) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('Gemini image edit failed after all retries');
}

/**
 * Check if Gemini image editing is available
 */
export function isGeminiEditAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ============================================================================
// PHOTO TO ILLUSTRATION TRANSFORMATION
// ============================================================================

/**
 * Parameters for transforming a photo into an illustration
 */
export interface PhotoTransformParams {
  /** Base64 encoded image data (without data URL prefix) */
  imageBase64: string;
  /** Optional story context for better caption generation (e.g., "Daddy taking Connor camping") */
  storyContext?: string;
  /** Illustration style */
  illustrationStyle: 'pixar' | 'classic';
  /** Photo index for context (1-based) */
  photoIndex?: number;
  /** Total photos for context */
  totalPhotos?: number;
}

/**
 * Result from photo transformation
 */
export interface PhotoTransformResult {
  /** Transformed illustration as base64 (without data URL prefix) */
  transformedImageBase64: string;
  /** AI-generated caption for the scene */
  caption: string;
  /** Generation time in seconds */
  generationTime: number;
}

/**
 * Transform a real photo into a children's book illustration
 *
 * Uses Gemini to:
 * 1. Generate a NEW animated illustration inspired by the photo (Pixar 3D or Classic 2D)
 * 2. Generate a descriptive caption using the provided story context
 *
 * IMPORTANT: This generates a completely NEW illustration, not an enhanced photo!
 *
 * @example
 * ```typescript
 * const result = await transformPhotoToIllustration({
 *   imageBase64: 'iVBORw0KGgo...',
 *   storyContext: 'Daddy and Mommy taking Connor and Carter on a camping trip',
 *   illustrationStyle: 'pixar',
 * });
 * ```
 */
export async function transformPhotoToIllustration({
  imageBase64,
  storyContext,
  illustrationStyle,
  photoIndex,
  totalPhotos,
}: PhotoTransformParams): Promise<PhotoTransformResult> {
  // Use OpenAI's gpt-image-1 for superior photo-to-illustration transformation
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (!geminiKey) {
    throw new Error('GEMINI_API_KEY is not configured (needed for caption generation)');
  }

  const startTime = Date.now();

  // Build the transformation prompt - simple and direct like ChatGPT UI
  const stylePrompt = illustrationStyle === 'pixar'
    ? 'Change this photo to animated version, Pixar style. Make it look like a frame from a Pixar movie like Toy Story, Coco, or Inside Out.'
    : 'Change this photo to animated version, classic Disney 2D illustration style. Make it look like a frame from a Disney animated classic.';

  console.log(`[OpenAI Transform] Transforming photo to ${illustrationStyle} style...`);

  // Convert base64 to buffer for OpenAI API
  const imageBuffer = Buffer.from(imageBase64, 'base64');

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;
  let transformedImageBase64 = '';

  // Try gpt-image-1.5 first, fallback to gpt-image-1 if not available
  const modelsToTry = ['gpt-image-1.5', 'gpt-image-1'];

  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Use OpenAI SDK directly (simpler and more reliable)
        const openaiModule = await import('openai');
        const OpenAI = openaiModule.default;
        const { toFile } = openaiModule;
        const openai = new OpenAI({ apiKey: openaiKey });

        // Create file using OpenAI's toFile helper
        const imageFile = await toFile(imageBuffer, 'photo.png', { type: 'image/png' });

        console.log(`[OpenAI Transform] Trying model: ${modelName} (attempt ${attempt}/${maxRetries})`);

        const response = await openai.images.edit({
          model: modelName as any, // Cast to any to bypass SDK type restrictions
          image: imageFile,
          prompt: stylePrompt,
          size: '1024x1024',
          quality: 'high',
        });

        const imageData = response.data?.[0]?.b64_json;
        if (!imageData) {
          throw new Error('No image returned from OpenAI');
        }

        transformedImageBase64 = imageData;
        console.log(`[OpenAI Transform] Success with model: ${modelName}`);
        break; // Success, exit retry loop
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        console.error(`[OpenAI Transform] Error with ${modelName} (attempt ${attempt}/${maxRetries}):`, errorMessage);

        // Check if it's a model not found error - try next model
        if (errorMessage.includes('model') && (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('invalid'))) {
          console.log(`[OpenAI Transform] Model ${modelName} not available, trying next...`);
          break; // Break inner loop, try next model
        }

        // Check if it's a rate limit error
        if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('quota')) {
          if (attempt < maxRetries) {
            const waitTime = Math.min(30000 * attempt, 120000); // Exponential backoff
            console.warn(`[OpenAI Transform] Rate limited (attempt ${attempt}/${maxRetries}). Waiting ${waitTime / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }
        }

        if (attempt === maxRetries) {
          // If this is the last model and last attempt, throw
          if (modelName === modelsToTry[modelsToTry.length - 1]) {
            throw lastError;
          }
        }
      }
    }

    // If we got a result, break out of model loop
    if (transformedImageBase64) break;
  }

  if (!transformedImageBase64) {
    throw lastError || new Error('Photo transformation failed after all retries');
  }

  const transformTime = (Date.now() - startTime) / 1000;
  console.log(`[OpenAI Transform] Image transformed in ${transformTime.toFixed(1)}s`);

  // Now generate caption using Gemini (it's good at this)
  const genAI = new GoogleGenAI({ apiKey: geminiKey });

  const contextInstructions = storyContext
    ? `Story context: ${storyContext}. Use character names from this context if applicable.`
    : '';
  const positionContext = photoIndex && totalPhotos
    ? `This is scene ${photoIndex} of ${totalPhotos}.`
    : '';

  const captionPrompt = `Look at this children's book illustration and write a SHORT caption (1-2 sentences max) for it.

${contextInstructions}
${positionContext}

The caption should:
- Describe what's happening in the scene
- Be suitable for reading aloud to children
- Be engaging and fun

Return ONLY the caption text, nothing else.`;

  let caption = '';
  try {
    const captionResult = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        { text: captionPrompt },
        {
          inlineData: {
            mimeType: 'image/png',
            data: transformedImageBase64,
          },
        },
      ],
    });

    const textPart = captionResult.candidates?.[0]?.content?.parts?.[0];
    if (textPart && 'text' in textPart) {
      caption = textPart.text?.trim() || '';
    }

    // Clean up caption
    caption = caption
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^#+\s*/gm, '') // Remove markdown headers
      .replace(/^\*+\s*/gm, '') // Remove bullet points
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();

    // If caption is too long, truncate to 2 sentences
    if (caption.length > 200) {
      const sentences = caption.match(/[^.!?]+[.!?]+/g) || [caption];
      caption = sentences.slice(0, 2).join(' ').trim();
    }
  } catch (error) {
    console.warn('[Gemini Caption] Failed to generate caption:', error);
    caption = 'A magical moment captured in time.'; // Fallback caption
  }

  const generationTime = (Date.now() - startTime) / 1000;
  console.log(`[OpenAI Transform] Complete in ${generationTime.toFixed(1)}s`);
  console.log(`[OpenAI Transform] Caption: ${caption.substring(0, 80)}...`);

  return {
    transformedImageBase64,
    caption,
    generationTime,
  };
}
