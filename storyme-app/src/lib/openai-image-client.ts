/**
 * OpenAI image client for character generation.
 * Sibling to gemini-image-client.ts — exposes the same 6 character preview
 * functions but routed through OpenAI's gpt-image-2 model.
 *
 * Branching is done at the call site in gemini-image-client.ts based on the
 * resolved ImageProvider. When provider === 'openai-gpt-image-2', the Gemini
 * function delegates to its OpenAI sibling here.
 */

import { OPENAI_IMAGE_MODEL, type ImageMedium } from './types/story';
import {
  buildKidCreationPrompt,
  shouldUseFaithfulnessPrompt,
  type CharacterStyle,
} from './character-prompts';
// NOTE: type-only imports from gemini-image-client to avoid runtime circular dependency.
import type {
  CharacterPreviewParams,
  CharacterPreviewResult,
  NonHumanPreviewParams,
  NonHumanPreviewResult,
  DescriptionOnlyPreviewParams,
  DescriptionOnlyPreviewResult,
} from './gemini-image-client';

const MAX_RETRIES = 3;

// ============================================================================
// SHARED OPENAI HELPERS
// ============================================================================

async function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const openaiModule = await import('openai');
  const OpenAI = openaiModule.default;
  return { client: new OpenAI({ apiKey }), toFile: openaiModule.toFile };
}

async function downloadImageAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

interface CallOpenAIParams {
  prompt: string;
  /**
   * Reference image(s) for `images.edit`. Accepts:
   *   - undefined → routes to `images.generate` (text-only)
   *   - Buffer    → single reference (existing call sites; sticker + character previews)
   *   - Buffer[]  → multiple references (new chapter-book Generate flow)
   *
   * For multi-image, the function tries the array first; on failure it
   * automatically retries with just the first buffer so a single bad
   * model response doesn't kill the request entirely.
   */
  referenceImageBuffer?: Buffer | Buffer[];
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  logTag: string;
}

/** Single call wrapper used by all preview functions. Handles retries + edit vs generate. */
export async function callOpenAIImage({
  prompt,
  referenceImageBuffer,
  size = '1024x1024',
  logTag,
}: CallOpenAIParams): Promise<{ b64: string; mimeType: string }> {
  const { client, toFile } = await getOpenAIClient();

  // Normalize to an array. [] = text-only generate; [single] = legacy
  // single-edit; [a, b, …] = multi-image edit.
  const buffers: Buffer[] = referenceImageBuffer
    ? Array.isArray(referenceImageBuffer)
      ? referenceImageBuffer
      : [referenceImageBuffer]
    : [];

  let lastError: Error | null = null;
  // Tracks whether we've already fallen back from array → single image
  // for this call. Set after a multi-image edit fails so subsequent
  // retry attempts use the single-image path.
  let multiImageFellBack = false;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[${logTag}] OpenAI ${OPENAI_IMAGE_MODEL} attempt ${attempt}/${MAX_RETRIES} (refs=${buffers.length})`);

      let response;
      if (buffers.length === 0) {
        response = await client.images.generate({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: OPENAI_IMAGE_MODEL as any,
          prompt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          size: size as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          quality: 'high' as any,
          n: 1,
        });
      } else if (buffers.length === 1 || multiImageFellBack) {
        // Existing single-image edit path — used by stickers, character
        // previews, and the multi-image fallback when an array was rejected.
        const onlyBuffer = buffers[0];
        const imageFile = await toFile(onlyBuffer, 'reference.png', { type: 'image/png' });
        response = await client.images.edit({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          model: OPENAI_IMAGE_MODEL as any,
          image: imageFile,
          prompt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          size: size as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          quality: 'high' as any,
        });
      } else {
        // Multi-image edit. SDK type accepts an array; gpt-image-2 may
        // or may not — wrapped in try/catch so a 400/422 just falls
        // back to the first ref.
        try {
          const files = await Promise.all(
            buffers.map((buf, i) =>
              toFile(buf, `reference-${i + 1}.png`, { type: 'image/png' })
            )
          );
          response = await client.images.edit({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            model: OPENAI_IMAGE_MODEL as any,
            image: files,
            prompt,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            size: size as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            quality: 'high' as any,
          });
        } catch (multiErr) {
          const msg = multiErr instanceof Error ? multiErr.message : String(multiErr);
          // Rate-limit errors should bubble to the outer retry loop —
          // they're transient and retrying with single-image won't help.
          if (msg.includes('429') || msg.includes('rate') || msg.includes('quota')) {
            throw multiErr;
          }
          console.warn(
            `[${logTag}] multi-image edit failed (${buffers.length} refs) — retrying with first ref only:`,
            msg
          );
          multiImageFellBack = true;
          continue; // re-enter the loop, this time hits the single-image branch
        }
      }

      const b64 = response.data?.[0]?.b64_json;
      if (!b64) {
        throw new Error('OpenAI response did not include b64_json image data');
      }
      return { b64, mimeType: 'image/png' };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;
      console.error(`[${logTag}] Error attempt ${attempt}/${MAX_RETRIES}:`, errorMessage);

      if (errorMessage.includes('429') || errorMessage.includes('rate') || errorMessage.includes('quota')) {
        if (attempt < MAX_RETRIES) {
          const waitTime = Math.min(30000 * attempt, 120000);
          console.warn(`[${logTag}] Rate limited. Waiting ${waitTime / 1000}s...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      if (attempt === MAX_RETRIES) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error(`[${logTag}] OpenAI image generation failed after all retries`);
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

interface BuildPromptArgs {
  style: CharacterStyle;
  medium: ImageMedium;
  name: string;
  /** Used for non-human + description-only modes. */
  characterType?: string;
  /** Free-form additional details. */
  details?: string;
  /** True when there is a reference image (photo modes). */
  hasReference: boolean;
}

function buildPrompt({
  style,
  medium,
  name,
  characterType,
  details,
  hasReference,
}: BuildPromptArgs): string {
  // Kid creations + digital art → faithfulness-first prompt.
  if (shouldUseFaithfulnessPrompt(medium) && hasReference) {
    return buildKidCreationPrompt({
      style,
      // OpenAI images.edit treats the image as primary input — no need for the
      // explicit "USE THE ATTACHED IMAGE" line that Gemini benefits from.
      emphasizeReference: false,
      name,
      // Pass the analyzer's element description as an explicit checklist so
      // multi-element drawings (e.g., witch + crown + potion) don't lose items.
      elementsDescription: details,
    });
  }

  // Default real_photo / no-reference path: concise stylization prompt.
  // OpenAI's reasoning model handles the heavy lifting that the Gemini
  // 35-line prompt did defensively. Keep it short.
  const styleDescription =
    style === 'pixar'
      ? '3D animated character portrait in Pixar / Disney Junior style — vibrant colors, smooth textures, large expressive eyes, friendly approachable expression, warm flattering lighting, head-and-shoulders composition, clean gradient background.'
      : '2D illustrated character portrait in classic children\'s storybook style — soft watercolor feel, warm golden-hour lighting, pastel palette, large expressive eyes, soft hand-drawn quality, head-and-shoulders composition, soft background.';

  if (!hasReference) {
    // Description-only mode.
    return `Render a ${styleDescription}

Character: ${name}${characterType ? ` (${characterType})` : ''}.
${details ? `Details: ${details}.` : ''}

Audience: children's storybook app, ages 5-8. Make the character appealing, memorable, and kid-friendly.`;
  }

  // Photo-based real_photo path.
  return `Render a ${styleDescription}

Character: ${name}${characterType ? ` (${characterType})` : ''}.
${details ? `Details: ${details}.` : ''}

FAITHFULNESS: preserve the subject's identity from the reference image — face shape, skin tone, hair color and style, distinctive features. Render in the animated style above; do NOT photorealistically copy the reference.

Audience: children's storybook app, ages 5-8.`;
}

// ============================================================================
// CHARACTER PREVIEW (HUMAN, PHOTO) — 3D PIXAR
// ============================================================================

export async function openaiGenerateCharacterPreview(
  params: CharacterPreviewParams,
  medium: ImageMedium = 'real_photo'
): Promise<CharacterPreviewResult> {
  const startTime = Date.now();
  const { name, referenceImageUrl, description } = params;

  const detailParts: string[] = [];
  if (description.age) detailParts.push(`age: ${description.age}`);
  if (description.hairColor) detailParts.push(`hair: ${description.hairColor}`);
  if (description.skinTone) detailParts.push(`skin tone: ${description.skinTone}`);
  if (description.otherFeatures) detailParts.push(description.otherFeatures);

  const prompt = buildPrompt({
    style: 'pixar',
    medium,
    name,
    details: detailParts.join(', ') || undefined,
    hasReference: true,
  });

  const buffer = await downloadImageAsBuffer(referenceImageUrl);
  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    referenceImageBuffer: buffer,
    size: '1024x1024',
    logTag: 'OpenAI Pixar',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
  };
}

// ============================================================================
// CHARACTER PREVIEW (HUMAN, PHOTO) — 2D CLASSIC
// ============================================================================

export async function openaiGenerateCharacterPreviewClassic(
  params: CharacterPreviewParams,
  medium: ImageMedium = 'real_photo'
): Promise<CharacterPreviewResult> {
  const startTime = Date.now();
  const { name, referenceImageUrl, description } = params;

  const detailParts: string[] = [];
  if (description.age) detailParts.push(`age: ${description.age}`);
  if (description.hairColor) detailParts.push(`hair: ${description.hairColor}`);
  if (description.skinTone) detailParts.push(`skin tone: ${description.skinTone}`);
  if (description.otherFeatures) detailParts.push(description.otherFeatures);

  const prompt = buildPrompt({
    style: 'classic',
    medium,
    name,
    details: detailParts.join(', ') || undefined,
    hasReference: true,
  });

  const buffer = await downloadImageAsBuffer(referenceImageUrl);
  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    referenceImageBuffer: buffer,
    size: '1024x1024',
    logTag: 'OpenAI Classic',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
  };
}

// ============================================================================
// NON-HUMAN PREVIEW (PHOTO) — 3D PIXAR
// ============================================================================

export async function openaiGenerateNonHumanPreview(
  params: NonHumanPreviewParams,
  medium: ImageMedium = 'real_photo'
): Promise<NonHumanPreviewResult> {
  const startTime = Date.now();
  const { name, referenceImageUrl, subjectType, briefDescription, additionalDetails } = params;

  const details = [briefDescription, additionalDetails].filter(Boolean).join('. ');
  const prompt = buildPrompt({
    style: 'pixar',
    medium,
    name,
    characterType: subjectType,
    details,
    hasReference: true,
  });

  const buffer = await downloadImageAsBuffer(referenceImageUrl);
  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    referenceImageBuffer: buffer,
    size: '1024x1024',
    logTag: 'OpenAI NonHuman Pixar',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
    subjectType,
  };
}

// ============================================================================
// NON-HUMAN PREVIEW (PHOTO) — 2D CLASSIC
// ============================================================================

export async function openaiGenerateNonHumanPreviewClassic(
  params: NonHumanPreviewParams,
  medium: ImageMedium = 'real_photo'
): Promise<NonHumanPreviewResult> {
  const startTime = Date.now();
  const { name, referenceImageUrl, subjectType, briefDescription, additionalDetails } = params;

  const details = [briefDescription, additionalDetails].filter(Boolean).join('. ');
  const prompt = buildPrompt({
    style: 'classic',
    medium,
    name,
    characterType: subjectType,
    details,
    hasReference: true,
  });

  const buffer = await downloadImageAsBuffer(referenceImageUrl);
  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    referenceImageBuffer: buffer,
    size: '1024x1024',
    logTag: 'OpenAI NonHuman Classic',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
    subjectType,
  };
}

// ============================================================================
// DESCRIPTION-ONLY PREVIEW — 3D PIXAR
// ============================================================================

export async function openaiGenerateDescriptionOnlyPreview(
  params: DescriptionOnlyPreviewParams
): Promise<DescriptionOnlyPreviewResult> {
  const startTime = Date.now();
  const { name, characterType, description } = params;

  const prompt = buildPrompt({
    style: 'pixar',
    medium: 'real_photo', // medium irrelevant without a reference image
    name,
    characterType,
    details: description,
    hasReference: false,
  });

  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    size: '1024x1024',
    logTag: 'OpenAI DescOnly Pixar',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
  };
}

// ============================================================================
// DESCRIPTION-ONLY PREVIEW — 2D CLASSIC
// ============================================================================

export async function openaiGenerateDescriptionOnlyPreviewClassic(
  params: DescriptionOnlyPreviewParams
): Promise<DescriptionOnlyPreviewResult> {
  const startTime = Date.now();
  const { name, characterType, description } = params;

  const prompt = buildPrompt({
    style: 'classic',
    medium: 'real_photo',
    name,
    characterType,
    details: description,
    hasReference: false,
  });

  const { b64, mimeType } = await callOpenAIImage({
    prompt,
    size: '1024x1024',
    logTag: 'OpenAI DescOnly Classic',
  });

  return {
    imageUrl: `data:${mimeType};base64,${b64}`,
    generationTime: (Date.now() - startTime) / 1000,
    prompt,
  };
}
