/**
 * Gemini Image Generation Client - POC
 *
 * Uses Google Gemini 3 Pro Image for character-consistent story images.
 * Key advantage: Native support for up to 5 human reference images.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

// Types
export interface CharacterReference {
  name: string;
  referenceImagePath?: string;  // Local file path
  referenceImageUrl?: string;   // URL (will be fetched)
  referenceImageBase64?: string; // Pre-encoded base64
  description: {
    age?: string;
    skinTone?: string;
    hairColor?: string;
    clothing?: string;
    otherFeatures?: string;
  };
}

export interface GeminiGenerateParams {
  characters: CharacterReference[];
  sceneDescription: string;
  artStyle?: string;
  aspectRatio?: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  imageSize?: '1K' | '2K' | '4K';
}

export interface GeminiGenerateResult {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  generationTimeMs: number;
  modelUsed: string;
}

// Client class
export class GeminiImageClient {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private modelName: string;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is required. Set it in environment or pass to constructor.');
    }

    this.genAI = new GoogleGenerativeAI(key);
    // Use Gemini 2.5 Flash Image for image generation
    // Available models: gemini-2.5-flash-image (recommended), gemini-2.0-flash-exp-image-generation
    this.modelName = 'gemini-2.5-flash-image';
    this.model = this.genAI.getGenerativeModel({
      model: this.modelName,
      generationConfig: {
        // @ts-expect-error - responseModalities is valid but not in types yet
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });
  }

  /**
   * Load image from file path and convert to base64
   */
  private async loadImageAsBase64(filePath: string): Promise<{ base64: string; mimeType: string }> {
    const absolutePath = path.resolve(filePath);
    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString('base64');

    // Detect mime type from extension
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
    };
    const mimeType = mimeTypes[ext] || 'image/jpeg';

    return { base64, mimeType };
  }

  /**
   * Fetch image from URL and convert to base64
   */
  private async fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    return { base64, mimeType };
  }

  /**
   * Build character description for prompt
   */
  private buildCharacterPrompt(char: CharacterReference): string {
    const parts = [char.name];

    if (char.description.age) {
      parts.push(`${char.description.age} years old`);
    }
    if (char.description.skinTone) {
      parts.push(`${char.description.skinTone} skin`);
    }
    if (char.description.hairColor) {
      parts.push(`${char.description.hairColor} hair`);
    }
    if (char.description.clothing) {
      parts.push(`wearing ${char.description.clothing}`);
    }
    if (char.description.otherFeatures) {
      parts.push(char.description.otherFeatures);
    }

    return parts.join(', ');
  }

  /**
   * Generate image with character consistency
   */
  async generateWithCharacters(params: GeminiGenerateParams): Promise<GeminiGenerateResult> {
    const startTime = Date.now();

    const {
      characters,
      sceneDescription,
      artStyle = "children's book illustration, colorful, whimsical, professional",
      aspectRatio = '1:1',
    } = params;

    // Build the content array with text and images
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentParts: any[] = [];

    // Build comprehensive prompt
    const characterDescriptions = characters
      .map(c => this.buildCharacterPrompt(c))
      .join('; and ');

    const fullPrompt = `Generate a ${artStyle} image showing: ${sceneDescription}

CHARACTERS (maintain exact appearance from reference photos):
${characters.map(c => `- ${this.buildCharacterPrompt(c)}`).join('\n')}

IMPORTANT RULES:
1. Each character must match their reference photo exactly (face, skin tone, hair)
2. Maintain the specified clothing for each character
3. Characters are HUMAN - do not merge with animals or objects
4. Style: Professional children's book illustration
5. Aspect ratio: ${aspectRatio}

Scene: ${sceneDescription}`;

    contentParts.push(fullPrompt);

    // Add reference images for each character (up to 5 supported)
    for (const char of characters.slice(0, 5)) {
      let imageData: { base64: string; mimeType: string } | null = null;

      if (char.referenceImageBase64) {
        imageData = {
          base64: char.referenceImageBase64,
          mimeType: 'image/jpeg'
        };
      } else if (char.referenceImagePath) {
        imageData = await this.loadImageAsBase64(char.referenceImagePath);
      } else if (char.referenceImageUrl) {
        imageData = await this.fetchImageAsBase64(char.referenceImageUrl);
      }

      if (imageData) {
        contentParts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: imageData.base64,
          },
        });
        // Add label for the reference image
        contentParts.push(`[Reference photo for ${char.name}]`);
      }
    }

    console.log(`[Gemini POC] Generating with ${characters.length} character references`);
    console.log(`[Gemini POC] Prompt: ${fullPrompt.substring(0, 200)}...`);

    try {
      const result = await this.model.generateContent(contentParts);
      const response = result.response;

      // Extract the generated image from response
      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in response');
      }

      // Find the image part
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imagePart = parts.find((p: any) => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        // Check if there's text explaining why no image was generated
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textPart = parts.find((p: any) => p.text);
        const errorMsg = textPart?.text || 'No image generated';
        throw new Error(`Image generation failed: ${errorMsg}`);
      }

      const generationTime = Date.now() - startTime;
      console.log(`[Gemini POC] Generated in ${generationTime}ms`);

      return {
        imageBase64: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
        prompt: fullPrompt,
        generationTimeMs: generationTime,
        modelUsed: this.modelName,
      };
    } catch (error) {
      console.error('[Gemini POC] Generation error:', error);
      throw error;
    }
  }

  /**
   * Save generated image to file
   */
  saveImage(result: GeminiGenerateResult, outputPath: string): void {
    const buffer = Buffer.from(result.imageBase64, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`[Gemini POC] Saved image to ${outputPath}`);
  }

  /**
   * Generate multiple scenes for a story (with same characters)
   */
  async generateStoryScenes(
    characters: CharacterReference[],
    scenes: string[],
    artStyle?: string,
    outputDir?: string
  ): Promise<GeminiGenerateResult[]> {
    const results: GeminiGenerateResult[] = [];

    for (let i = 0; i < scenes.length; i++) {
      console.log(`[Gemini POC] Generating scene ${i + 1}/${scenes.length}`);

      const result = await this.generateWithCharacters({
        characters,
        sceneDescription: scenes[i],
        artStyle,
      });

      results.push(result);

      if (outputDir) {
        const outputPath = path.join(outputDir, `scene-${i + 1}.png`);
        this.saveImage(result, outputPath);
      }

      // Small delay to avoid rate limits
      if (i < scenes.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}

// Export singleton instance
let clientInstance: GeminiImageClient | null = null;

export function getGeminiClient(): GeminiImageClient {
  if (!clientInstance) {
    clientInstance = new GeminiImageClient();
  }
  return clientInstance;
}
