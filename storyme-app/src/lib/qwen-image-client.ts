/**
 * Qwen Image Edit Client
 *
 * Uses Segmind API for image editing via Qwen-Image-Edit model.
 * Segmind provides international access to Qwen-Image-Edit.
 * Supports: remove objects, add elements, change expressions, style transfer
 *
 * API Documentation: https://www.segmind.com/models/qwen-image-edit-fast
 *
 * Note: DashScope (Alibaba) is not available internationally yet.
 * Using Segmind as the provider for Qwen-Image-Edit.
 */

// Result type for image editing
export interface QwenEditResult {
  imageUrl: string; // Data URL (base64) or URL
  mimeType: string;
  generationTime: number;
}

// Segmind API response type
interface SegmindResponse {
  image?: string; // Base64 image data or URL
  error?: string;
  message?: string;
}

/**
 * Check if Qwen Image Edit is available (API key configured)
 */
export function isQwenAvailable(): boolean {
  return !!process.env.SEGMIND_API_KEY;
}

/**
 * Edit an image using Qwen-Image-Edit model via Segmind
 *
 * @param imageUrl - URL of the image to edit (must be publicly accessible)
 * @param instruction - Natural language instruction for editing (e.g., "remove the cat in background")
 * @returns Edited image as base64 data URL
 */
export async function editImageWithQwen(
  imageUrl: string,
  instruction: string
): Promise<QwenEditResult> {
  const apiKey = process.env.SEGMIND_API_KEY;

  if (!apiKey) {
    throw new Error('SEGMIND_API_KEY is not configured. Get one at https://www.segmind.com');
  }

  if (!imageUrl) {
    throw new Error('Image URL is required');
  }

  if (!instruction || instruction.trim().length < 3) {
    throw new Error('Please provide a clear instruction for editing');
  }

  const startTime = Date.now();

  console.log(`[Qwen/Segmind] Editing image with instruction: "${instruction}"`);
  console.log(`[Qwen/Segmind] Image URL: ${imageUrl.substring(0, 100)}...`);

  // Segmind API endpoint for Qwen Image Edit
  const endpoint = 'https://api.segmind.com/v1/qwen-image-edit-fast';

  // Retry logic for rate limits
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageUrl,
          prompt: instruction,
          steps: 8, // Balanced speed/quality (1-20)
          guidance: 4, // Moderate prompt adherence (1-25)
          seed: -1, // Random for variety
          image_format: 'png',
          quality: 90,
          base64: true, // Return as base64
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Qwen/Segmind] API error (${response.status}):`, errorText);

        // Check for rate limit
        if (response.status === 429) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`[Qwen/Segmind] Rate limited, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        throw new Error(`Segmind API error: ${response.status} - ${errorText}`);
      }

      // Check content type to determine response format
      const contentType = response.headers.get('content-type') || '';

      let imageDataUrl: string;

      if (contentType.includes('image/')) {
        // Response is raw image bytes
        const imageBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(imageBuffer).toString('base64');
        const mimeType = contentType.split(';')[0] || 'image/png';
        imageDataUrl = `data:${mimeType};base64,${base64}`;
        console.log(`[Qwen/Segmind] Received raw image (${mimeType})`);
      } else {
        // Response is JSON
        const data: SegmindResponse = await response.json();

        // Check for API-level errors
        if (data.error || data.message) {
          throw new Error(`Segmind API error: ${data.error || data.message}`);
        }

        if (!data.image) {
          throw new Error('No image in Segmind API response');
        }

        // data.image could be base64 or URL
        if (data.image.startsWith('data:')) {
          imageDataUrl = data.image;
        } else if (data.image.startsWith('http')) {
          // It's a URL, fetch and convert
          const imgResponse = await fetch(data.image);
          const imgBuffer = await imgResponse.arrayBuffer();
          const base64 = Buffer.from(imgBuffer).toString('base64');
          imageDataUrl = `data:image/png;base64,${base64}`;
        } else {
          // Assume it's raw base64
          imageDataUrl = `data:image/png;base64,${data.image}`;
        }
      }

      const generationTime = (Date.now() - startTime) / 1000;
      console.log(`[Qwen/Segmind] Image edited successfully in ${generationTime.toFixed(1)}s`);

      return {
        imageUrl: imageDataUrl,
        mimeType: 'image/png',
        generationTime,
      };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if it's a rate limit error
      if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('rate')) {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          console.log(`[Qwen/Segmind] Rate limited (attempt ${attempt}/${maxRetries}), waiting ${waitTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      // For other errors, throw immediately
      if (attempt === maxRetries) {
        break;
      }
    }
  }

  // All retries exhausted
  console.error('[Qwen/Segmind] All retries exhausted:', lastError);
  throw lastError || new Error('Failed to edit image after multiple attempts');
}
