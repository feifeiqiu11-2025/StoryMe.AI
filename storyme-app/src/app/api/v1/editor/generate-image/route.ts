/**
 * API Route: POST /api/v1/editor/generate-image
 *
 * Inline image generation for the chapter book editor. Picks an
 * ImageProvider (default 'gemini-3.1' / Nano Banana 2) and routes to:
 *   - openai-gpt-image-2 → OpenAI gpt-image-2 (multi-image edit-mode
 *     when references attached, generate when text-only)
 *   - gemini-2.5 / gemini-3.1 → Gemini scene generator
 *   - flux → Fal.ai FLUX (fallback)
 *
 * Inputs:
 *   - prompt: short kid-typed description (3–500 chars)
 *   - characterIds: 0..5 character_library IDs to use as visual reference
 *   - referenceImageUrl: optional uploaded image (kid sketch, photo) used
 *     as an additional visual reference
 *   - artStyle: one of the predefined styles; appended to the prompt
 *   - imageProvider: 'gemini-3.1' (default) | 'gemini-2.5' |
 *     'openai-gpt-image-2' | 'flux'
 *
 * Output: a public URL inside our storage bucket.
 *
 * Principle 1 (Security): auth + per-character ownership check; prompt
 *   length capped to bound generation cost.
 * Principle 5 (Reuse): wraps existing Gemini, OpenAI, and Fal clients.
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
import { callOpenAIImage } from '@/lib/openai-image-client';
import {
  normalizeImageProvider,
  isGeminiProvider,
  isOpenAIProvider,
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
  /** Set when the kid is editing an earlier generation ("make the wolf
   *  smaller"). The server treats this image as the base to modify and
   *  routes to an edit-capable model (OpenAI gpt-image-2 or Gemini —
   *  both accept image+text input). Flux falls back to OpenAI when an
   *  edit is requested. */
  previousImageUrl: z.string().url().optional(),
  artStyle: z
    .enum(Object.keys(ART_STYLES) as [ArtStyleKey, ...ArtStyleKey[]])
    .optional(),
  imageProvider: z.string().optional(),
});

interface CharacterRow {
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
}

// 300s is the Vercel Pro ceiling for serverless functions; gpt-image-2
// with multi-image edits routinely needs 60–120s and occasionally more.
// On Hobby this caps at 60s — no harm, just less headroom.
export const maxDuration = 300;

/** Internal soft-timeout — we want to fail fast with a clean JSON error
 *  before Vercel kills the function and returns its plain-text error
 *  page (which clients can't parse as JSON). 10s margin under
 *  maxDuration is enough for our catch block to run and respond. */
const PROVIDER_TIMEOUT_MS = 290_000;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `${label} timed out after ${Math.round(ms / 1000)}s. Try a shorter prompt, fewer reference characters, or switch image models.`
            )
          ),
        ms
      );
    }),
  ]);
}

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
      previousImageUrl,
      artStyle,
      imageProvider: requestedProvider,
    } = validation.data;

    const requestedProviderNormalized: ImageProvider = normalizeImageProvider(requestedProvider);
    // Edits require an image-conditioned model. OpenAI gpt-image-2 has
    // true edit semantics; Gemini accepts the prior image as a strong
    // reference. Flux has no clean edit path, so when the kid asks for
    // an edit we silently re-route Flux requests to OpenAI (or Gemini
    // if OpenAI isn't configured). For first-time generations we honor
    // whatever the kid picked.
    let provider = requestedProviderNormalized;
    if (previousImageUrl && !isOpenAIProvider(provider) && !isGeminiProvider(provider)) {
      provider = process.env.OPENAI_API_KEY
        ? ('openai-gpt-image-2' as ImageProvider)
        : isGeminiAvailable()
          ? ('gemini-3.1' as ImageProvider)
          : provider; // give up — caller will see the upstream error
    }
    const useOpenAI = isOpenAIProvider(provider);
    const useGemini = isGeminiProvider(provider) && isGeminiAvailable();
    const styledArtStyle = artStyle ? ART_STYLES[artStyle] : undefined;

    // Load + ownership-check the requested characters with the fields
    // needed for description-rich prompts.
    let characters: CharacterRow[] = [];
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

    // ── Generate ───────────────────────────────────────────────────
    let imageBuffer: Buffer;
    let actualProvider: string = provider;

    if (useOpenAI) {
      imageBuffer = await withTimeout(
        runOpenAI({
          prompt,
          characters,
          referenceImageUrl,
          previousImageUrl,
          styledArtStyle,
        }),
        PROVIDER_TIMEOUT_MS,
        'OpenAI image generation'
      );
      actualProvider = provider;
    } else if (useGemini) {
      imageBuffer = await withTimeout(
        runGemini({
          prompt,
          characters,
          referenceImageUrl,
          previousImageUrl,
          styledArtStyle,
          provider,
        }),
        PROVIDER_TIMEOUT_MS,
        'Gemini image generation'
      );
      actualProvider = provider;
    } else {
      imageBuffer = await withTimeout(
        runFal({
          prompt,
          characters,
          referenceImageUrl,
          styledArtStyle,
        }),
        PROVIDER_TIMEOUT_MS,
        'Flux image generation'
      );
      actualProvider = 'flux';
    }

    // ── Compress + upload ──────────────────────────────────────────
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
      provider: actualProvider,
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

// ────────────────────────────────────────────────────────────────────
// Provider-specific generators
// ────────────────────────────────────────────────────────────────────

interface RunArgs {
  prompt: string;
  characters: CharacterRow[];
  referenceImageUrl?: string;
  /** Edit-mode: the prior generated image the kid wants to tweak. When
   *  set, the prompt is treated as an edit instruction ("add a moon")
   *  rather than a fresh scene description, and this image is the most
   *  important reference. */
  previousImageUrl?: string;
  styledArtStyle?: string;
  provider?: ImageProvider;
}

/**
 * OpenAI (gpt-image-2) — passes all reference images (library characters'
 * preview URLs + the kid's attached upload) as an array to images.edit.
 * Falls back to images.generate when no references. The OpenAI client
 * itself handles the case where gpt-image-2 rejects multi-image (retries
 * with first ref only).
 */
async function runOpenAI({
  prompt,
  characters,
  referenceImageUrl,
  previousImageUrl,
  styledArtStyle,
}: RunArgs): Promise<Buffer> {
  // Collect reference images. Edit-mode: the previous generation goes
  // FIRST so gpt-image-2 treats it as the base to modify. Otherwise the
  // library characters lead, then the kid's uploaded reference. Cap at
  // 5 — OpenAI's edit endpoint is happiest with a small number.
  const refs: Array<{ url: string; label: string }> = [];
  if (previousImageUrl) {
    refs.push({
      url: previousImageUrl,
      label: "the previous image — keep its overall composition, characters, and style, but apply the changes described in the prompt",
    });
  }
  for (const c of characters) {
    const url = c.animated_preview_url || c.reference_image_url;
    if (url) {
      refs.push({
        url,
        label: buildCharacterLabel(c),
      });
    }
    if (refs.length >= 4) break; // leave room for kid's upload
  }
  if (referenceImageUrl) {
    refs.push({
      url: referenceImageUrl,
      label: "the kid's reference image (treat as a key character or subject in the scene)",
    });
  }

  // Download buffers in parallel. Per-image failures fall through with
  // the rest — better to render with fewer refs than abort entirely.
  const buffers = (
    await Promise.all(
      refs.map(async ({ url }) => {
        try {
          const r = await fetch(url);
          if (!r.ok) throw new Error(`fetch ${r.status}`);
          return Buffer.from(await r.arrayBuffer());
        } catch (err) {
          console.warn('[generate-image] ref image fetch failed:', url, err);
          return null;
        }
      })
    )
  ).filter((b): b is Buffer => b !== null);

  // Build the prompt — only includes the references section when we
  // actually have buffers (a partial fetch failure could empty the list).
  const fullPrompt = buildChapterBookPrompt({
    sceneDescription: prompt,
    references: buffers.length > 0 ? refs.slice(0, buffers.length) : [],
    styledArtStyle,
    isEdit: Boolean(previousImageUrl),
  });

  const { b64 } = await callOpenAIImage({
    prompt: fullPrompt,
    referenceImageBuffer: buffers.length > 0 ? buffers : undefined,
    logTag: 'chapter-book-generate',
  });
  return Buffer.from(b64, 'base64');
}

/**
 * Gemini path — uses the picture-book scene generator. Best for
 * multi-character scenes where each character needs visual fidelity.
 */
async function runGemini({
  prompt,
  characters,
  referenceImageUrl,
  previousImageUrl,
  styledArtStyle,
  provider,
}: RunArgs): Promise<Buffer> {
  const geminiChars: GeminiCharacterInfo[] = [];
  // Edit-mode: previous generation goes first as the strongest reference
  // so Gemini anchors on its composition + style and applies the prompt
  // as a delta.
  if (previousImageUrl) {
    geminiChars.push({
      name: 'Previous Image',
      referenceImageUrl: previousImageUrl,
      description: {
        ai_description:
          'The previous version of this picture. Keep its overall composition, characters, and style, and apply the changes described in the prompt.',
      } as unknown as GeminiCharacterInfo['description'],
    });
  }
  for (const c of characters) {
    geminiChars.push({
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
    });
  }
  if (referenceImageUrl) {
    geminiChars.push({
      name: 'Reference Image',
      referenceImageUrl,
      description: {
        ai_description: 'Visual reference provided by the author.',
      } as unknown as GeminiCharacterInfo['description'],
    });
  }

  // For edits, frame the prompt as a delta on the prior image so Gemini
  // anchors on it instead of re-imagining the scene from text alone.
  const sceneDescription = previousImageUrl
    ? `Edit the "Previous Image" with this change: ${prompt}. Keep everything else about the image the same.`
    : prompt;

  const out = await generateImageWithGemini({
    characters: geminiChars,
    sceneDescription,
    artStyle: styledArtStyle,
    modelId: resolveGeminiImageModel(provider),
  });

  const match = /^data:([^;]+);base64,(.+)$/.exec(out.imageUrl);
  if (!match) {
    throw new Error('Unexpected Gemini image format');
  }
  return Buffer.from(match[2], 'base64');
}

/**
 * Fal / FLUX path — fallback. Uses multi or single character helper
 * based on count.
 */
async function runFal({
  prompt,
  characters,
  referenceImageUrl,
  styledArtStyle,
}: RunArgs): Promise<Buffer> {
  const styledPrompt = styledArtStyle ? `${prompt}. Style: ${styledArtStyle}` : prompt;

  let resultUrl: string;
  if (characters.length >= 2) {
    const promptInfos: CharacterPromptInfo[] = characters.map((c) => ({
      name: c.name,
      referenceImageUrl: c.animated_preview_url || c.reference_image_url || '',
      description: {
        ai_description: c.ai_description ?? '',
      } as unknown as CharacterPromptInfo['description'],
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
  return Buffer.from(await sourceResp.arrayBuffer());
}

// ────────────────────────────────────────────────────────────────────
// Prompt builder
// ────────────────────────────────────────────────────────────────────

/**
 * Compose a chapter-book-style prompt. Branches on what the kid
 * provided — minimal, directional, no over-engineering. Ordered so the
 * scene goes first (most important), then references with labels, then
 * style and safety guidance.
 */
function buildChapterBookPrompt({
  sceneDescription,
  references,
  styledArtStyle,
  isEdit = false,
}: {
  sceneDescription: string;
  references: Array<{ label: string }>;
  styledArtStyle?: string;
  isEdit?: boolean;
}): string {
  const lines: string[] = isEdit
    ? [
        "Children's chapter book illustration for ages 7–12.",
        '',
        `Edit the first attached image: ${sceneDescription}. Keep everything else about the image the same.`,
      ]
    : [
        "Children's chapter book illustration for ages 7–12.",
        '',
        `Scene: ${sceneDescription}`,
      ];

  if (references.length > 0) {
    lines.push(
      '',
      'Use the attached reference images. Each subject (character, animal, object, or scene) should appear in the new image faithfully — keep its appearance, colors, and key features intact:'
    );
    references.forEach((ref, i) => {
      lines.push(`  - Image ${i + 1}: ${ref.label}`);
    });
  }

  if (styledArtStyle) {
    lines.push('', `Style: ${styledArtStyle}`);
  }

  lines.push(
    '',
    'Keep the image age-appropriate, clear, and free of scary content. Avoid text in the image unless the scene specifically requires it.'
  );

  return lines.join('\n');
}

/** One-line description for a character_library row, used in the prompt. */
function buildCharacterLabel(c: CharacterRow): string {
  const bits: string[] = [c.name];
  if (c.ai_description) {
    // Truncate long ai_description so the prompt doesn't balloon.
    bits.push(c.ai_description.slice(0, 120).trim());
  } else {
    const traits: string[] = [];
    if (c.age) traits.push(c.age);
    if (c.hair_color) traits.push(`${c.hair_color} hair`);
    if (c.skin_tone) traits.push(`${c.skin_tone} skin`);
    if (c.clothing) traits.push(`wearing ${c.clothing}`);
    if (traits.length > 0) bits.push(traits.join(', '));
  }
  return bits.join(' — ');
}
