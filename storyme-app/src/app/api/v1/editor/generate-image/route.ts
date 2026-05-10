/**
 * API Route: POST /api/v1/editor/generate-image
 *
 * Inline image generation for the chapter book editor. Mirrors the
 * picture-book scene generation: picks an ImageProvider (default
 * 'gemini-3.1' / Nano Banana 2), routes to Gemini for the gemini-*
 * providers, Fal.ai for 'flux'. OpenAI provider is exposed in the UI
 * but only enabled for admins (mirrors the picture-book setup).
 *
 * Inputs:
 *   - prompt: short kid-typed description (3–500 chars)
 *   - characterIds: 0..5 character_library IDs to use as visual reference
 *   - referenceImageUrl: optional uploaded image (kid sketch, photo) used
 *     as an additional visual reference
 *   - artStyle: one of the predefined styles; appended to the prompt
 *   - imageProvider: 'gemini-3.1' (default) | 'gemini-2.5' | 'flux'
 *
 * Output: a public URL inside our storage bucket.
 *
 * Principle 1 (Security): auth + per-character ownership check; prompt
 *   length capped to bound generation cost.
 * Principle 5 (Reuse): wraps existing Gemini + Fal clients.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  generateImageWithCharacter,
  generateImageWithMultipleCharacters,
  type CharacterPromptInfo,
} from '@/lib/fal-client';
import {
  generateImageWithGemini,
  resolveGeminiImageModel,
  isGeminiAvailable,
  type GeminiCharacterInfo,
} from '@/lib/gemini-image-client';
import {
  normalizeImageProvider,
  isGeminiProvider,
  type ImageProvider,
} from '@/lib/types/story';
import { compressImage } from '@/lib/services/imageProcessing.service';
import { randomUUID } from 'crypto';

const BUCKET = 'generated-images';

// Canonical chapter-book art styles, matching the picture-book flow
// (ScenePreviewApproval): 'pixar' (3D), 'classic' (watercolor 2D),
// 'coloring' (B&W line art). Each maps to a prompt fragment passed to
// the image model. The MediaPanel UI sends these exact keys.
const ART_STYLES = {
  pixar: '3D Pixar style, modern 3D animation look, soft lighting, expressive characters',
  classic: "classic 2D children's book illustration, watercolor, gentle colors, painterly",
  coloring: 'black and white coloring book line art, clean outlines, no fill, printable',
} as const;

type ArtStyleKey = keyof typeof ART_STYLES;

const GenerateImageSchema = z.object({
  prompt: z.string().min(3).max(500),
  characterIds: z.array(z.string().uuid()).max(5).optional(),
  referenceImageUrl: z.string().url().optional(),
  artStyle: z
    .enum(Object.keys(ART_STYLES) as [ArtStyleKey, ...ArtStyleKey[]])
    .optional(),
  imageProvider: z.string().optional(),
});

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validation = GenerateImageSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }
    const {
      prompt,
      characterIds = [],
      referenceImageUrl,
      artStyle,
      imageProvider: requestedProvider,
    } = validation.data;

    // Resolve the requested provider; fall back to the system default
    // (gemini-3.1) for unknown values. Same normalization the picture-book
    // scene route uses, so behavior is consistent.
    const provider: ImageProvider = normalizeImageProvider(requestedProvider);
    const useGemini = isGeminiProvider(provider) && isGeminiAvailable();

    const styledArtStyle = artStyle ? ART_STYLES[artStyle] : undefined;

    // Load + ownership-check the requested characters with the fields
    // needed for description-rich prompts.
    let characters: Array<{
      id: string;
      name: string;
      animated_preview_url: string | null;
      reference_image_url: string | null;
      ai_description: string | null;
      skin_tone: string | null;
      hair_color: string | null;
      age: string | null;
      clothing: string | null;
      other_features: string | null;
    }> = [];
    if (characterIds.length > 0) {
      const { data, error } = await supabase
        .from('character_library')
        .select(
          'id, name, animated_preview_url, reference_image_url, ai_description, skin_tone, hair_color, age, clothing, other_features, user_id'
        )
        .in('id', characterIds);
      if (error) throw error;
      const rows = data ?? [];
      for (const c of rows) {
        if (c.user_id !== user.id) {
          return NextResponse.json({ error: 'Not your character' }, { status: 403 });
        }
      }
      characters = rows;
    }

    // Run the appropriate generator. Gemini is preferred — it handles
    // multiple reference images natively and produces more consistent
    // characters. Fal/FLUX is the fallback.
    let imageBuffer: Buffer;
    if (useGemini) {
      const geminiChars: GeminiCharacterInfo[] = characters.map((c) => ({
        name: c.name,
        referenceImageUrl: c.animated_preview_url || c.reference_image_url || '',
        description: {
          ai_description: c.ai_description ?? '',
          skinTone: c.skin_tone ?? undefined,
          hairColor: c.hair_color ?? undefined,
          age: c.age ?? undefined,
          clothing: c.clothing ?? undefined,
          otherFeatures: c.other_features ?? undefined,
        } as unknown as GeminiCharacterInfo['description'],
      }));
      // Kid's attached image goes in as a synthetic "reference" character
      // so Gemini sees it alongside the named characters as inline image
      // input. Name kept generic since it's not a story character.
      if (referenceImageUrl) {
        geminiChars.push({
          name: 'Reference Image',
          referenceImageUrl,
          description: { ai_description: 'Visual reference provided by the author.' } as unknown as GeminiCharacterInfo['description'],
        });
      }

      const out = await generateImageWithGemini({
        characters: geminiChars,
        sceneDescription: prompt,
        artStyle: styledArtStyle,
        modelId: resolveGeminiImageModel(provider),
      });

      // Gemini returns a base64 data URL — decode to buffer for compress + upload.
      const match = /^data:([^;]+);base64,(.+)$/.exec(out.imageUrl);
      if (!match) {
        throw new Error('Unexpected Gemini image format');
      }
      imageBuffer = Buffer.from(match[2], 'base64');
    } else {
      // Fal / FLUX path. Mirror multi vs single char split from the
      // picture-book scene generator.
      const styledPrompt = styledArtStyle ? `${prompt}. Style: ${styledArtStyle}` : prompt;

      let resultUrl: string;
      if (characters.length >= 2) {
        const promptInfos: CharacterPromptInfo[] = characters.map((c) => ({
          name: c.name,
          referenceImageUrl: c.animated_preview_url || c.reference_image_url || '',
          description: { ai_description: c.ai_description ?? '' } as unknown as CharacterPromptInfo['description'],
        }));
        const out = await generateImageWithMultipleCharacters({
          characters: promptInfos,
          sceneDescription: styledPrompt,
        });
        resultUrl = out.imageUrl;
      } else {
        const fallbackChar = characters[0];
        const ref =
          referenceImageUrl ??
          fallbackChar?.animated_preview_url ??
          fallbackChar?.reference_image_url ??
          '';
        const out = await generateImageWithCharacter({
          referenceImageUrl: ref,
          sceneDescription: styledPrompt,
        });
        resultUrl = out.imageUrl;
      }

      const sourceResp = await fetch(resultUrl);
      if (!sourceResp.ok) {
        throw new Error(`Failed to fetch generated image: ${sourceResp.status}`);
      }
      imageBuffer = Buffer.from(await sourceResp.arrayBuffer());
    }

    const compressed = await compressImage(imageBuffer);

    const serviceClient = createServiceRoleClient();
    const filename = `${randomUUID()}.webp`;
    const path = `editor/${user.id}/${filename}`;
    const { error: uploadError } = await serviceClient.storage
      .from(BUCKET)
      .upload(path, compressed.buffer, {
        contentType: compressed.contentType,
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) {
      console.error('Storage upload failed:', uploadError);
      throw new Error('Failed to save the generated image');
    }
    const { data: { publicUrl } } = serviceClient.storage
      .from(BUCKET)
      .getPublicUrl(path);

    return NextResponse.json({
      success: true,
      provider: useGemini ? provider : 'flux',
      image: {
        url: publicUrl,
        width: compressed.width,
        height: compressed.height,
        bytes: compressed.bytes,
      },
    });
  } catch (error) {
    console.error('generate-image route error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate image';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

