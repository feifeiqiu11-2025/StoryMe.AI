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
import { CharacterDescription } from './types/story';

export interface GeminiCharacterInfo {
  name: string;
  referenceImageUrl: string;
  description: CharacterDescription;
}

export interface GeminiGenerateParams {
  characters: GeminiCharacterInfo[];
  sceneDescription: string;
  artStyle?: string;
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
 * Priority for clothing:
 * 1. Scene-specific explicit costume (user wrote "wearing X" or "dressed as X")
 * 2. Character's base outfit (from description.clothing)
 * 3. If no outfit specified, use character description as-is
 *
 * NOTE: Theme-based auto clothing was REMOVED
 * We no longer auto-add "winter jacket" for snowy scenes or "pajamas" for Christmas
 * Clothing changes only when user explicitly mentions it in the scene script
 */
function buildSmartCharacterPrompt(
  char: GeminiCharacterInfo,
  sceneDescription: string,
  _storyTheme: string | null  // kept for API compatibility, but no longer used for clothing
): { prompt: string; isAnimal: boolean } {
  const { name, description } = char;

  // Get the character description
  const charContext = description.fullDescription || buildMinimalCharacterDescription(name, description);

  // Use isAnimal flag set during character creation
  // This is the source of truth - user explicitly chose character type
  const isAnimal = description.isAnimal === true;

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
  // Apply clothing logic for consistency

  // Check for scene-specific role clothing (highest priority)
  const roleClothing = detectRoleClothing(sceneDescription, name);
  if (roleClothing) {
    return {
      prompt: `${charContext}, wearing ${roleClothing} (scene-specific costume)`,
      isAnimal: false,
    };
  }

  // Use base outfit from character description (no auto theme clothing)
  const characterKey = name.toLowerCase();
  const baseOutfit = description.clothing;
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
}: GeminiGenerateParams): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Detect story theme for appropriate clothing
  const storyTheme = detectStoryTheme(sceneDescription);

  if (storyTheme) {
    console.log(`[Gemini] Detected story theme: ${storyTheme}`);
  }

  // Build character descriptions using smart prompt builder
  // Handles: animal detection, clothing priority, outfit caching
  const characterPrompts = characters.map(c => {
    const result = buildSmartCharacterPrompt(c, sceneDescription, storyTheme);
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

  // Build prompt with clear separation between humans and animals
  const fullPrompt = `Create a 3D children's book illustration: ${sceneDescription}

STYLE: 3D animated Pixar/Disney style, soft rounded features, vibrant colors, large expressive eyes. Square 1:1.

IMPORTANT:
- Generate an ILLUSTRATED 3D animated image, NOT a photograph
- Reference photos show face/hair features only - transform into cute 3D animated characters
- NO religious figures (Jesus, Buddha, etc.)
${(hasAnimalsInScene || hasAnimalCharacters) && hasHumanCharacters ? `- CRITICAL: Human children have HUMAN faces. Animals have ANIMAL faces. NEVER mix - no human-animal hybrids, no human body with animal head, no animal body with human face.` : ''}

${humanCharacterSection}
${animalCharacterSection}
${sceneAnimalSection}

RULES:
- Keep clothing consistent with character description unless scene specifies costume/role/holiday attire
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
}: GeminiGenerateParams): Promise<GeminiGenerateResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const startTime = Date.now();

  // Use new @google/genai SDK
  const genAI = new GoogleGenAI({ apiKey });

  // Detect story theme for appropriate clothing
  const storyTheme = detectStoryTheme(sceneDescription);

  if (storyTheme) {
    console.log(`[Gemini Classic] Detected story theme: ${storyTheme}`);
  }

  // Build character descriptions using smart prompt builder
  // Handles: animal detection, clothing priority, outfit caching
  const characterPrompts = characters.map(c => {
    const result = buildSmartCharacterPrompt(c, sceneDescription, storyTheme);
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

  // Build Classic Storybook style prompt (2D illustration) - Modern vibrant digital style
  const fullPrompt = `Create a 2D children's book illustration: ${sceneDescription}

STYLE: Modern 2D digital cartoon, vibrant saturated colors, smooth cel-shading, large glossy expressive eyes, soft warm lighting, clean polished style. Square 1:1.

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
- Keep clothing consistent with character description unless scene specifies costume/role/holiday attire
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
- Soft, rounded features with warm, flattering lighting
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

  // Build description-based prompt for 3D style
  const fullPrompt = `Create a 3D animated character portrait showing: ${name} (a ${characterType})

=== CRITICAL RENDERING STYLE (MANDATORY) ===
- Render as a 3D ANIMATED/ILLUSTRATED character (Pixar/Disney Junior style)
- This is a ${characterType} character - create a cute, appealing animated version
- Style: Modern 3D animation like Pixar, Disney Junior, or Cocomelon
- The character should be expressive, friendly, and kid-appropriate

=== ART STYLE ===
- 3D rendered character portrait (like Pixar, Disney Junior, Cocomelon)
- Soft, rounded features with warm, flattering lighting
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
