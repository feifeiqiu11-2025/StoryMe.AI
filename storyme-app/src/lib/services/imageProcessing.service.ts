/**
 * Image processing service.
 *
 * Why server-side: kids on old phones / borrowed devices may not have
 * client-side compression libraries available, and we can't trust client
 * size claims either. sharp re-encodes every upload, strips EXIF (privacy
 * win), and converts to WebP for ~80% size reduction without visible
 * quality loss at book-cover sizes.
 *
 * The 1600px cap is a deliberate ceiling: full-bleed book pages are
 * rendered at ~600px in the reader and ~1240px in PDFs, so 1600 is enough
 * headroom for retina without storing wasted pixels.
 */

import sharp from 'sharp';

export interface CompressedImage {
  buffer: Buffer;
  contentType: 'image/webp';
  width: number;
  height: number;
  bytes: number;
}

export interface CompressOptions {
  /** Long-edge cap in pixels. Defaults to 1600 (book-page friendly). */
  maxDimension?: number;
  /** WebP quality 0–100. Defaults to 82. */
  quality?: number;
}

/**
 * Compress and re-encode an image buffer to WebP.
 * Strips metadata (EXIF, orientation handled before strip), resizes if
 * either dimension exceeds maxDimension, preserves aspect ratio.
 */
export async function compressImage(
  input: Buffer,
  options: CompressOptions = {}
): Promise<CompressedImage> {
  const { maxDimension = 1600, quality = 82 } = options;

  const pipeline = sharp(input, { failOn: 'error' })
    .rotate() // Honor EXIF orientation, then drop EXIF below.
    .resize({
      width: maxDimension,
      height: maxDimension,
      fit: 'inside', // Preserve aspect ratio; only shrink if larger.
      withoutEnlargement: true,
    })
    .webp({ quality });

  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    contentType: 'image/webp',
    width: info.width,
    height: info.height,
    bytes: data.byteLength,
  };
}
