/**
 * Client-side image normalization for character uploads.
 *
 * For HEIC/HEIF (the iPhone default), dynamically loads heic2any to decode in WASM
 * because canvas-native HEIC support is unreliable across browsers (only iOS/macOS
 * Safari handles it consistently). For everything else, goes straight to canvas.
 * Then renders to a canvas, downscales if it exceeds maxDim on the long edge, and
 * re-encodes as JPEG.
 *
 * Why: iPhone photos arrive as 3-10MB HEIC or large JPEG. Pushing those raw through
 * the upload + analyze pipeline causes slow fetches, server-side decode failures, and
 * Vercel function timeouts that the old UI mislabeled as "rate limited". Normalizing
 * to a sane-sized JPEG up front fixes all three. Aspect ratio is always preserved —
 * we resize, never crop.
 */

export interface CompressedImage {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
}

const DEFAULT_MAX_DIM = 4096;
const DEFAULT_QUALITY = 0.9;

function isHeic(file: File): boolean {
  const t = file.type.toLowerCase();
  if (t === 'image/heic' || t === 'image/heif') return true;
  // iPhone files sometimes arrive with empty or generic MIME — fall back to extension.
  const name = file.name.toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

export async function compressImageForUpload(
  input: File,
  options: { maxDim?: number; quality?: number } = {}
): Promise<CompressedImage> {
  const maxDim = options.maxDim ?? DEFAULT_MAX_DIM;
  const quality = options.quality ?? DEFAULT_QUALITY;

  // HEIC needs a WASM-based decoder. Dynamically import so the ~600KB cost only
  // hits sessions that actually upload a HEIC.
  let decodableBlob: Blob = input;
  if (isHeic(input)) {
    try {
      const { default: heic2any } = await import('heic2any');
      const result = await heic2any({ blob: input, toType: 'image/jpeg', quality: 0.95 });
      decodableBlob = Array.isArray(result) ? result[0] : result;
    } catch (err) {
      console.error('[compress-image] HEIC decode failed:', err);
      throw new Error("Couldn't decode this HEIC file. Please convert to JPEG or PNG and try again.");
    }
  }

  const dataUrl = await readAsDataUrl(decodableBlob);
  const img = await loadImage(dataUrl);

  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > maxDim ? maxDim / longEdge : 1;
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');
  ctx.drawImage(img, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  const baseName = stripExtension(input.name) || 'image';
  const file = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });

  return {
    blob,
    file,
    width,
    height,
    originalBytes: input.size,
    compressedBytes: blob.size,
  };
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(
        new Error(
          "Couldn't read this image format. Please convert to JPEG or PNG and try again."
        )
      );
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas re-encode failed'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}
