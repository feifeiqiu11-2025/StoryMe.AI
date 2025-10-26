/**
 * Cover Text Overlay Service
 * Overlays text on cover images using canvas
 *
 * English flow: AI generates title on image, overlay only author/copyright at bottom
 * Chinese flow: Clean AI image, overlay title/author/copyright (no backgrounds)
 *
 * Note: This service runs server-side only (Next.js API routes)
 */

import { createCanvas, loadImage } from 'canvas';

export interface CoverTextOptions {
  title: string;
  author?: string;
  age?: number;
  language?: 'en' | 'zh';
}

/**
 * Overlay text on a cover image
 * @param imageUrl - URL of the base cover image
 * @param options - Text to overlay (title, author, age, language)
 * @returns Buffer of the final image with overlaid text
 */
export async function overlayCoverText(
  imageUrl: string,
  options: CoverTextOptions
): Promise<Buffer> {
  const { title, author, age, language = 'en' } = options;

  // Split flow by language
  if (language === 'en') {
    return overlayEnglishCover(imageUrl, { author, age });
  } else {
    return overlayChineseCover(imageUrl, { title, author, age });
  }
}

/**
 * English cover overlay: Only author/copyright at bottom
 * (Title is AI-generated on the image)
 */
async function overlayEnglishCover(
  imageUrl: string,
  options: { author?: string; age?: number }
): Promise<Buffer> {
  const { author, age } = options;

  try {
    // Load the base cover image
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the base image
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // Configure text rendering
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Calculate font sizes - LARGER for better visibility
    const baseFontSize = Math.floor(image.width / 8); // Increased from /15 to /8 to match Chinese
    const authorFontSize = Math.floor(baseFontSize * 0.6); // Increased from 0.4 to 0.6
    const copyrightFontSize = Math.floor(baseFontSize * 0.45); // Increased from 0.3 to 0.45
    const fontFamily = 'Georgia, serif';

    // Draw author at bottom (if provided)
    let currentY = image.height * 0.88;

    if (author) {
      const authorText = age ? `${author}, age ${age}` : author;

      ctx.font = `${authorFontSize}px ${fontFamily}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      ctx.strokeText(authorText, image.width / 2, currentY);
      ctx.fillText(authorText, image.width / 2, currentY);

      currentY += authorFontSize * 1.5;
    }

    // Draw copyright below author
    const copyrightText = '© KindleWood Studio';
    ctx.font = `${copyrightFontSize}px ${fontFamily}`;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';

    ctx.strokeText(copyrightText, image.width / 2, currentY);
    ctx.fillText(copyrightText, image.width / 2, currentY);

    return canvas.toBuffer('image/png');

  } catch (error) {
    console.error('Error overlaying English cover:', error);
    throw new Error(`Failed to overlay English cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Chinese cover overlay: Title, author, and copyright (no background boxes)
 * (AI generates clean image without text)
 */
async function overlayChineseCover(
  imageUrl: string,
  options: { title: string; author?: string; age?: number }
): Promise<Buffer> {
  const { title, author, age } = options;

  try {
    // Load the base cover image
    const image = await loadImage(imageUrl);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');

    // Draw the base image
    ctx.drawImage(image, 0, 0, image.width, image.height);

    // Configure text rendering
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Calculate font sizes - MUCH LARGER for better visibility
    const baseFontSize = Math.floor(image.width / 8); // Increased from /15 to /8
    const titleFontSize = Math.floor(baseFontSize * 1.2); // Title even bigger
    const authorFontSize = Math.floor(baseFontSize * 0.6); // Increased from 0.4 to 0.6
    const copyrightFontSize = Math.floor(baseFontSize * 0.45); // Increased from 0.3 to 0.45

    // Use system fonts that work on server-side canvas
    // Note: We use 'sans-serif' as fallback which will use system default fonts
    const fontFamily = 'sans-serif';

    // Draw title at top (centered, 15% from top)
    const titleY = image.height * 0.15;
    const titleMaxWidth = image.width * 0.85;

    ctx.font = `bold ${titleFontSize}px ${fontFamily}`;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 5;

    const titleLines = wrapText(ctx, title, titleMaxWidth);
    const titleLineHeight = titleFontSize * 1.2;

    titleLines.forEach((line, index) => {
      const y = titleY + (index * titleLineHeight);
      // Strong outline
      ctx.strokeText(line, image.width / 2, y);
      ctx.strokeText(line, image.width / 2, y);
      // Fill
      ctx.fillText(line, image.width / 2, y);
    });

    // Draw author at bottom (if provided)
    let currentY = image.height * 0.88;

    if (author) {
      const authorText = age ? `${author}，${age}岁` : author;

      ctx.font = `${authorFontSize}px ${fontFamily}`;
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;

      ctx.strokeText(authorText, image.width / 2, currentY);
      ctx.strokeText(authorText, image.width / 2, currentY);
      ctx.fillText(authorText, image.width / 2, currentY);

      currentY += authorFontSize * 1.5;
    }

    // Draw copyright below author
    const copyrightText = '© KindleWood Studio';
    ctx.font = `${copyrightFontSize}px ${fontFamily}`;
    ctx.lineWidth = 2;
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#000000';

    ctx.strokeText(copyrightText, image.width / 2, currentY);
    ctx.strokeText(copyrightText, image.width / 2, currentY);
    ctx.fillText(copyrightText, image.width / 2, currentY);

    return canvas.toBuffer('image/png');

  } catch (error) {
    console.error('Error overlaying Chinese cover:', error);
    throw new Error(`Failed to overlay Chinese cover: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Wrap text to fit within a maximum width
 * @param ctx - Canvas 2D context
 * @param text - Text to wrap
 * @param maxWidth - Maximum width in pixels
 * @returns Array of text lines
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      // Line is too long, save current line and start new one
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  // Add the last line
  if (currentLine) {
    lines.push(currentLine);
  }

  // Fallback: if still no lines, split by characters (for Chinese or very long words)
  if (lines.length === 0 || lines.some(line => ctx.measureText(line).width > maxWidth)) {
    return wrapTextByCharacters(ctx, text, maxWidth);
  }

  return lines;
}

/**
 * Wrap text by characters (for Chinese or very long words)
 * @param ctx - Canvas 2D context
 * @param text - Text to wrap
 * @param maxWidth - Maximum width in pixels
 * @returns Array of text lines
 */
function wrapTextByCharacters(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  let currentLine = '';

  for (const char of text) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}
