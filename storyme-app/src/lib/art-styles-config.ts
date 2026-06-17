/**
 * Art Style Registry — single source of truth for art styles.
 *
 * Historically art styles were defined in many places: the type was declared
 * ~5 times, the per-style prompt strings were duplicated across the Gemini /
 * OpenAI / Fal providers (with slightly different wording), and the picker UI
 * was reimplemented twice. Adding one style meant editing ~15-18 sites.
 *
 * This module centralizes the parts that are safe to centralize:
 *   - the ArtStyleType union
 *   - per-style display metadata (label, description) for pickers
 *   - the per-provider STYLE prompt fragments
 *
 * IMPORTANT (behavior-preserving): every string below is copied VERBATIM from
 * the original call sites. Do not reword when migrating — a wording change is a
 * behavior change to image generation.
 *
 * CAVEAT — Gemini is only partially centralizable here. Unlike OpenAI (which
 * uses a clean `SCENE_STYLE_LINES` lookup), the Gemini client embeds each
 * `geminiStyleLine` inside structurally different per-style functions
 * (generateImageWithGemini / ...Classic / ...Coloring), each with its own
 * surrounding rules — including hard "NOT a photograph / no photo realism"
 * lines in the Pixar and Classic templates. So this registry holds the Gemini
 * STYLE *fragment* only; the base templates still live in the client. A future
 * "realistic" style needs its own Gemini handling (it must drop those
 * anti-photoreal rules), not just a new entry here.
 */

export type ArtStyleType = 'pixar' | 'classic' | 'coloring' | 'ghibli' | 'realistic';

export interface ArtStyleDefinition {
  /** Stable id used across UI, API payloads, and provider lookups. */
  id: ArtStyleType;
  /** Short label shown on the picker button. */
  label: string;
  /** Helper text shown under the picker. */
  description: string;
  /**
   * OpenAI scene STYLE line — verbatim from openai-image-client.ts
   * `SCENE_STYLE_LINES`.
   */
  openaiSceneLine: string;
  /**
   * Gemini scene STYLE fragment — verbatim from gemini-image-client.ts. This is
   * ONLY the `STYLE:` line; the surrounding template differs per style and
   * stays in the client (see file-level caveat).
   */
  geminiStyleLine: string;
}

/**
 * Ordered list of art styles (order = picker display order: matches the
 * original StyleSelector layout pixar → classic → coloring → ghibli).
 */
export const ART_STYLES: ArtStyleDefinition[] = [
  {
    id: 'pixar',
    label: '3D Pixar',
    description: 'Vibrant 3D animated characters like Disney/Pixar movies',
    openaiSceneLine:
      '3D Pixar-style animated illustration — soft cinematic lighting, vibrant saturated colors, rounded friendly shapes, gentle depth of field.',
    geminiStyleLine:
      '3D animated Pixar/Disney style, soft rounded features, vibrant colors, large expressive eyes. Square 1:1.',
  },
  {
    id: 'classic',
    label: 'Classic 2D',
    description: 'Soft, hand-drawn illustrations with a cozy storybook feel',
    openaiSceneLine:
      "2D classic children's storybook illustration — soft watercolor textures, warm cozy colors, hand-drawn feel.",
    geminiStyleLine:
      'Modern 2D digital cartoon, vibrant saturated colors, smooth cel-shading, large glossy expressive eyes, soft warm lighting, clean polished style. Square 1:1.',
  },
  {
    id: 'ghibli',
    label: 'Ghibli',
    description: 'Studio Ghibli-inspired hand-painted look, warm and whimsical',
    openaiSceneLine:
      'Studio Ghibli-inspired 2D illustration — painterly backgrounds, soft natural light, gentle muted colors, hand-painted feel.',
    geminiStyleLine:
      'Studio Ghibli-inspired illustration, warm rich colors. Square 1:1.',
  },
  {
    // NEW: realistic / real-world look for factual & educational books.
    // NOTE: this is a generated photorealistic ILLUSTRATION, never an actual
    // photo — the Gemini realistic branch keeps the "no real internet photo"
    // guard (see gemini-image-client.ts). Real-world scale/anatomy accuracy is
    // applied ONLY in this style, never globally.
    id: 'realistic',
    label: 'Realistic',
    description: 'Lifelike, photo-real look for factual and educational books',
    openaiSceneLine:
      'Photorealistic, lifelike image — naturalistic detail, realistic lighting and textures, true-to-life colors and accurate real-world proportions; wholesome and age-appropriate.',
    geminiStyleLine:
      'Photorealistic, lifelike image with naturalistic detail, realistic lighting and textures, true-to-life colors. Square 1:1.',
  },
  {
    id: 'coloring',
    label: 'Coloring',
    description: 'Black & white line art for kids to color (cover stays colorful)',
    openaiSceneLine:
      'Black-and-white coloring-book line art — clean bold even outlines, NO shading, NO color, pure white background, simple shapes a child can color in.',
    geminiStyleLine:
      'Clean thin black outlines only. Cartoon style with expressive faces. Simple but recognizable features. Simplified background. Square 1:1.',
  },
];

/** Lookup by id. */
export const ART_STYLE_BY_ID: Record<ArtStyleType, ArtStyleDefinition> =
  ART_STYLES.reduce((acc, s) => {
    acc[s.id] = s;
    return acc;
  }, {} as Record<ArtStyleType, ArtStyleDefinition>);

/** Set of valid ids — handy for runtime validation at API boundaries. */
export const ART_STYLE_IDS: ArtStyleType[] = ART_STYLES.map((s) => s.id);

export function isArtStyle(value: unknown): value is ArtStyleType {
  return typeof value === 'string' && (ART_STYLE_IDS as string[]).includes(value);
}
