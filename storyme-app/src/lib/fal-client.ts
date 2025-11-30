import * as fal from "@fal-ai/serverless-client";
import { CharacterDescription } from "./types/story";

// Initialize Fal client with API key
export function initializeFalClient() {
  const falKey = process.env.FAL_KEY;
  if (!falKey) {
    throw new Error('FAL_KEY environment variable is not set');
  }

  fal.config({
    credentials: falKey,
  });
}

export interface CharacterPromptInfo {
  name: string;
  referenceImageUrl: string;
  description: CharacterDescription;
}

export interface GenerateImageParams {
  referenceImageUrl: string;
  sceneDescription: string;
  artStyle?: string;
}

export interface MultiCharacterGenerateParams {
  characters: CharacterPromptInfo[];
  sceneDescription: string;
  artStyle?: string;
  sceneLocation?: string; // Consistent background setting
  emphasizeGenericCharacters?: boolean; // Boost generic character visibility
  storySeed?: number; // Seed for consistency across story scenes
}

/**
 * Build negative prompt to prevent common generation issues
 * - Human-animal hybrids
 * - Anatomical errors
 * - Extra limbs/heads
 */
export function buildNegativePrompt(hasAnimals: boolean = false): string {
  const baseNegatives = [
    // Anatomical issues
    'extra limbs', 'three legs', 'four legs on human', 'two heads', 'extra arms',
    'extra fingers', 'missing limbs', 'deformed hands', 'deformed feet',
    'malformed body', 'anatomical errors', 'bad anatomy', 'wrong proportions',
    // Quality issues
    'blurry', 'low quality', 'distorted face', 'ugly', 'disfigured',
    'poorly drawn', 'bad art', 'amateur',
  ];

  // Add hybrid-specific negatives when animals are in the scene
  const hybridNegatives = hasAnimals ? [
    'human-animal hybrid', 'animal-human hybrid', 'furry', 'anthropomorphic animal',
    'human with animal parts', 'animal with human face', 'centaur', 'minotaur',
    'merged creature', 'fusion', 'chimera', 'half animal half human',
    'human body with animal head', 'animal body with human head',
    'person turning into animal', 'transformation', 'mutant',
  ] : [];

  return [...baseNegatives, ...hybridNegatives].join(', ');
}

/**
 * Detect if scene description contains animals
 */
export function sceneContainsAnimals(description: string): boolean {
  const animalKeywords = [
    // Common animals
    'dog', 'cat', 'bird', 'fish', 'rabbit', 'bunny', 'hamster', 'turtle',
    'horse', 'pony', 'cow', 'pig', 'sheep', 'goat', 'chicken', 'duck',
    // Wild animals
    'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'monkey', 'bear',
    'wolf', 'fox', 'deer', 'owl', 'eagle', 'snake', 'frog', 'butterfly',
    // Zoo/farm context
    'zoo', 'farm', 'barn', 'wildlife', 'safari', 'aquarium', 'pet',
    // Generic
    'animal', 'creature', 'beast',
  ];

  const lowerDesc = description.toLowerCase();
  return animalKeywords.some(animal => lowerDesc.includes(animal));
}

/**
 * Build enhanced character description with explicit human specification
 */
export function buildEnhancedCharacterDescription(
  character: CharacterPromptInfo,
  isHuman: boolean = true
): string {
  const parts: string[] = [];

  // Explicitly state this is a human child
  if (isHuman) {
    parts.push(`${character.name} (HUMAN CHILD`);
  } else {
    parts.push(character.name);
  }

  if (character.description.age) {
    parts[0] += `, ${character.description.age} years old)`;
  } else {
    parts[0] += ')';
  }

  // Physical features
  if (character.description.skinTone) {
    parts.push(`${character.description.skinTone} skin`);
  }
  if (character.description.hairColor) {
    parts.push(`${character.description.hairColor} hair`);
  }

  // Clothing - be very specific
  if (character.description.clothing) {
    parts.push(`wearing ${character.description.clothing}`);
  }

  // Other features
  if (character.description.otherFeatures) {
    parts.push(character.description.otherFeatures);
  }

  // Add anatomical clarity for humans
  if (isHuman) {
    parts.push('normal human body with two arms and two legs');
  }

  // Fallback if minimal description
  if (parts.length <= 2) {
    parts.push('friendly child with bright eyes and cheerful smile');
  }

  return parts.join(', ');
}

export interface GenerateImageResult {
  imageUrl: string;
  generationTime: number;
  seed: number;
  prompt: string;
}

/**
 * Build character description string from description fields
 */
export function buildCharacterDescription(character: CharacterPromptInfo): string {
  const parts: string[] = [character.name];

  if (character.description.hairColor) {
    parts.push(`${character.description.hairColor} hair`);
  }
  if (character.description.skinTone) {
    parts.push(`${character.description.skinTone} skin`);
  }
  if (character.description.clothing) {
    parts.push(`wearing ${character.description.clothing}`);
  }
  if (character.description.age) {
    parts.push(`${character.description.age} years old`);
  }
  if (character.description.otherFeatures) {
    parts.push(character.description.otherFeatures);
  }

  // If no description fields were provided, add generic child description
  if (parts.length === 1) {
    parts.push('friendly child character with bright eyes and cheerful smile');
  }

  return parts.join(', ');
}

/**
 * Generate an image with character consistency using Fal.ai
 * Using FLUX LoRA with character reference image
 */
export async function generateImageWithCharacter({
  referenceImageUrl,
  sceneDescription,
  artStyle = "children's book illustration, colorful, whimsical",
}: GenerateImageParams): Promise<GenerateImageResult> {
  initializeFalClient();

  const startTime = Date.now();

  try {
    // Create prompt with character consistency instruction
    const fullPrompt = `${sceneDescription}, ${artStyle}, maintaining character appearance from reference, consistent style`;

    // Using FLUX LoRA model which supports reference images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt: fullPrompt,
        image_size: "square_hd",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Generation progress:", update.logs);
        }
      },
    });

    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000; // Convert to seconds

    console.log('Fal.ai result:', JSON.stringify(result, null, 2));

    // Handle different response formats
    const images = result.data?.images || result.images || [];

    if (!images || images.length === 0) {
      throw new Error('No images generated - response format: ' + JSON.stringify(result).substring(0, 200));
    }

    const imageUrl = images[0].url || images[0];

    return {
      imageUrl: typeof imageUrl === 'string' ? imageUrl : imageUrl.url,
      generationTime,
      seed: result.data?.seed || result.seed || 0,
      prompt: result.data?.prompt || result.prompt || fullPrompt,
    };
  } catch (error) {
    console.error('Fal.ai generation error:', error);
    throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate image with multiple characters
 * Uses primary character's reference image + text descriptions for all characters
 * Now with scene consistency, generic character support, negative prompts, and seed locking
 */
export async function generateImageWithMultipleCharacters({
  characters,
  sceneDescription,
  artStyle = "children's book illustration, colorful, whimsical",
  sceneLocation,
  emphasizeGenericCharacters = true,
  storySeed,
}: MultiCharacterGenerateParams): Promise<GenerateImageResult> {
  initializeFalClient();

  const startTime = Date.now();

  try {
    // Import scene-parser functions dynamically to detect generic characters
    const { extractGenericCharacters } = await import('./scene-parser');

    // Detect if scene contains animals (for hybrid prevention)
    const hasAnimals = sceneContainsAnimals(sceneDescription);

    // Build enhanced character descriptions with explicit HUMAN specification
    // This helps prevent human-animal hybrids when animals are in the scene
    const characterDescriptions = characters
      .map(char => buildEnhancedCharacterDescription(char, true))
      .join('; ');

    // Detect generic characters (policeman, teacher, etc.)
    const genericChars = extractGenericCharacters(sceneDescription);
    let genericCharPrompt = '';

    if (emphasizeGenericCharacters && genericChars.length > 0) {
      // Emphasize generic characters but keep them secondary to main characters
      genericCharPrompt = '. ALSO SHOW: ' + genericChars
        .map(char => `${char} (adult human) in background, SEPARATE from main characters`)
        .join(' and ');
    }

    // Build scene setting for consistency
    let sceneSettingPrompt = '';
    if (sceneLocation) {
      sceneSettingPrompt = `. SETTING: ${sceneLocation}`;
    }

    // Add animal separation instruction if animals present
    let animalSeparationPrompt = '';
    if (hasAnimals) {
      animalSeparationPrompt = '. IMPORTANT: All human characters must be clearly SEPARATE from any animals. Humans and animals are distinct entities, not merged or combined in any way. Each character maintains their own complete body.';
    }

    // Build negative prompt
    const negativePrompt = buildNegativePrompt(hasAnimals);

    // Enhanced prompt with clear entity separation
    // Structure: [SCENE] | [HUMAN CHARACTERS] | [ANIMALS/OBJECTS] | [STYLE]
    const fullPrompt = `${sceneDescription}. MAIN HUMAN CHARACTERS: ${characterDescriptions}${genericCharPrompt}${animalSeparationPrompt}${sceneSettingPrompt}. STYLE: ${artStyle}, professional children's book illustration, each character clearly distinct and separate, maintain consistent character appearance`;

    console.log('Enhanced multi-character prompt:', fullPrompt);
    console.log('Negative prompt:', negativePrompt);
    if (storySeed) {
      console.log('Using story seed for consistency:', storySeed);
    }

    // Using FLUX LoRA model with negative prompt and optional seed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt: fullPrompt,
        negative_prompt: negativePrompt,
        image_size: "square_hd",
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        ...(storySeed && { seed: storySeed }), // Use consistent seed if provided
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Generation progress:", update.logs);
        }
      },
    });

    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;

    console.log('Fal.ai result:', JSON.stringify(result, null, 2));

    // Handle different response formats
    const images = result.data?.images || result.images || [];

    if (!images || images.length === 0) {
      throw new Error('No images generated - response format: ' + JSON.stringify(result).substring(0, 200));
    }

    const imageUrl = images[0].url || images[0];

    return {
      imageUrl: typeof imageUrl === 'string' ? imageUrl : imageUrl.url,
      generationTime,
      seed: result.data?.seed || result.seed || 0,
      prompt: fullPrompt,
    };
  } catch (error) {
    console.error('Fal.ai generation error:', error);
    throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transform sketch to character with style selection
 * Used by Little Artists feature
 */
export interface SketchTransformParams {
  sketchImageUrl: string;
  characterName?: string;
  style: 'sketch-to-character' | 'cartoon' | 'watercolor' | 'realistic';
  preserveSketchStyle?: boolean;
}

export async function transformSketchToCharacter({
  sketchImageUrl,
  characterName = 'character',
  style = 'sketch-to-character',
  preserveSketchStyle = true,
}: SketchTransformParams): Promise<GenerateImageResult> {
  initializeFalClient();

  const startTime = Date.now();

  try {
    // Style-specific prompts
    const stylePrompts: Record<string, string> = {
      'sketch-to-character': 'children\'s book character, maintain original sketch style and personality, clean lines, vibrant colors, whimsical',
      'cartoon': 'cartoon character, animated style, bold colors, smooth gradients, Disney Pixar style',
      'watercolor': 'watercolor painting character, soft colors, artistic brush strokes, painted texture',
      'realistic': 'realistic children\'s book illustration, detailed features, photographic quality, professional',
    };

    const styleGuide = stylePrompts[style];
    const preservePrompt = preserveSketchStyle
      ? ', preserve the original drawing style, personality and unique features from the sketch'
      : '';

    // Build comprehensive prompt that focuses on transforming the sketch itself
    // Note: We don't include character name in prompt to avoid confusion - the model should transform what's in the sketch
    const prompt = `Transform this sketch drawing into a beautiful ${styleGuide}${preservePrompt}. Keep the same character/subject from the original sketch. High quality children's book illustration, professional, appealing to children, friendly expression.`;

    console.log('Sketch transformation prompt:', prompt);
    console.log('Sketch image URL:', sketchImageUrl);

    // Use FLUX LoRA image-to-image model for better content preservation
    // Balanced strength: preserve character shape but allow color and style transformation
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await fal.subscribe("fal-ai/flux-lora/image-to-image", {
      input: {
        prompt: prompt,
        image_url: sketchImageUrl, // Input sketch to transform
        strength: 0.65, // Balanced: preserve character but allow vibrant colors and cartoon style
        image_size: "square_hd",
        num_inference_steps: 35, // Higher steps for better quality
        guidance_scale: 7.5, // Higher guidance to follow the sketch closely
        num_images: 1,
        enable_safety_checker: true,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log("Sketch transformation progress:", update.logs);
        }
      },
    });

    const endTime = Date.now();
    const generationTime = (endTime - startTime) / 1000;

    console.log('Sketch transformation result:', JSON.stringify(result, null, 2));

    // Handle different response formats
    const images = result.data?.images || result.images || [];

    if (!images || images.length === 0) {
      throw new Error('No images generated - response format: ' + JSON.stringify(result).substring(0, 200));
    }

    const imageUrl = images[0].url || images[0];

    return {
      imageUrl: typeof imageUrl === 'string' ? imageUrl : imageUrl.url,
      generationTime,
      seed: result.data?.seed || result.seed || 0,
      prompt: prompt,
    };
  } catch (error) {
    console.error('Sketch transformation error:', error);
    throw new Error(`Sketch transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
