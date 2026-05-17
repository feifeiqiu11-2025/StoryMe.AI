/**
 * Rewrite a Supabase Storage public URL to the image-transform endpoint
 * so we can request a thumbnail instead of the full-size original.
 *
 * Supabase URLs look like:
 *   https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * The image-transform endpoint lives at:
 *   https://<proj>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=…
 *
 * Non-Supabase URLs (Fal, OpenAI, Gemini direct, etc.) pass through
 * unchanged — the caller doesn't need to know which provider produced
 * the image.
 */
export function thumbnailUrl(
  url: string | null | undefined,
  width: number,
  height: number = width,
): string | null {
  if (!url) return null;
  const marker = '/storage/v1/object/public/';
  if (!url.includes(marker)) return url;
  const rewritten = url.replace(marker, '/storage/v1/render/image/public/');
  const sep = rewritten.includes('?') ? '&' : '?';
  return `${rewritten}${sep}width=${width}&height=${height}&resize=cover`;
}
