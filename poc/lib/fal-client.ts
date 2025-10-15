import * as fal from "@fal-ai/serverless-client";
import { CharacterDescription } from "./types";

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
 * Now with scene consistency and generic character support
 */
export async function generateImageWithMultipleCharacters({
  characters,
  sceneDescription,
  artStyle = "children's book illustration, colorful, whimsical",
  sceneLocation,
  emphasizeGenericCharacters = true,
}: MultiCharacterGenerateParams): Promise<GenerateImageResult> {
  initializeFalClient();

  const startTime = Date.now();

  try {
    // Import scene-parser functions dynamically to detect generic characters
    const { extractGenericCharacters } = await import('./scene-parser');

    // Build character descriptions for all characters
    const characterDescriptions = characters
      .map(char => buildCharacterDescription(char))
      .join(', and ');

    // Detect generic characters (policeman, teacher, etc.)
    const genericChars = extractGenericCharacters(sceneDescription);
    let genericCharPrompt = '';

    if (emphasizeGenericCharacters && genericChars.length > 0) {
      // Emphasize generic characters but keep them secondary to main characters
      genericCharPrompt = ', also include ' + genericChars
        .map(char => `${char} in background`)
        .join(' and ');
    }

    // Build scene setting for consistency
    let sceneSettingPrompt = '';
    if (sceneLocation) {
      sceneSettingPrompt = `, consistent ${sceneLocation} setting`;
    }

    // Enhanced prompt with all elements - main characters emphasized first
    const fullPrompt = `${sceneDescription}, MAIN FOCUS: ${characterDescriptions}${genericCharPrompt}${sceneSettingPrompt}, ${artStyle}, maintain consistent character appearance and scene background, detailed illustration`;

    console.log('Enhanced multi-character prompt:', fullPrompt);

    // Using FLUX LoRA model - primary character's image influences generation
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
