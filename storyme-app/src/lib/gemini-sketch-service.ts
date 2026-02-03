/**
 * Gemini Sketch Guide Service
 *
 * Generates step-by-step drawing guides for kids using Gemini.
 *
 * Features:
 * - Text-based step breakdown (3-6 steps)
 * - Sketch-style image generation for each step
 * - Kid-friendly language and simple shapes
 * - Print-ready black & white line drawings
 *
 * Follows Principle 5: Reuse Before Rebuild (uses existing Gemini client)
 */

import { GoogleGenAI } from '@google/genai';
import { isGeminiAvailable } from './gemini-image-client';

export interface DrawingStep {
  step_number: number;
  title: string;
  description: string;
  image_prompt: string; // Internal prompt for image generation
}

export interface SketchGuideInput {
  character_name: string;
  character_type: string;
  additional_details?: string;
}

export interface SketchGuide {
  guide_image_url: string; // Single image showing all steps in a grid
  steps: Array<{
    step_number: number;
    title: string;
    description: string;
  }>;
  character_description: string;
}

/**
 * Generate simple sketch for kids to learn drawing
 * (Simplified version - just one cute sketch, not step-by-step)
 */
export async function generateSketchGuide(
  input: SketchGuideInput
): Promise<SketchGuide> {
  if (!isGeminiAvailable()) {
    throw new Error('Gemini API is not configured');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found');
  }

  const genAI = new GoogleGenAI({ apiKey });

  console.log('[GeminiSketch] Generating simple sketch for:', input.character_name);

  // Generate ONE simple, cute sketch that kids can copy
  const guideImageUrl = await generateSimpleSketch(genAI, input);

  return {
    guide_image_url: guideImageUrl,
    steps: [], // No steps needed - just one simple sketch
    character_description: `${input.character_name} the ${input.character_type}`,
  };
}

/**
 * Ask Gemini to break down the character into drawing steps
 */
async function generateDrawingSteps(
  genAI: GoogleGenAI,
  input: SketchGuideInput
): Promise<{ steps: DrawingStep[] }> {
  const prompt = `You are a children's art teacher helping kids learn to draw.

Break down how to draw a "${input.character_type}" named "${input.character_name}" into 3-6 simple steps for a 7-year-old child.

Additional details: ${input.additional_details || 'none'}

CRITICAL RULE: The final step must result in a complete, recognizable character that matches what a 7-year-old could realistically draw by following these steps.

RULES:
- Use 3-6 steps (choose based on complexity - simpler characters use fewer steps)
- Maximum 6 steps
- Each step should be ONE sentence, max 15 words
- Use simple, encouraging language
- Focus on basic shapes first (circles, ovals, triangles, rectangles)
- Build complexity gradually with each step adding to the previous
- Each step must show cumulative progress (step 3 includes everything from steps 1 and 2)
- Be specific about what to draw, not just "add details"
- Use kid-friendly terms (not technical art terms)
- The final step should include simple features (eyes, mouth, basic details) that make it recognizable

EXAMPLES OF GOOD STEPS FOR AN EAGLE:
✓ Step 1: "Draw a big oval for the body"
✓ Step 2: "Add a smaller circle on top for the head"
✓ Step 3: "Draw two triangle wings coming from the sides of the body"
✓ Step 4: "Add a small triangle beak on the front of the head"
✓ Step 5: "Draw two dots for eyes and add small triangle tail feathers"

EXAMPLES OF BAD STEPS:
✗ "Add anatomical proportions" (too technical)
✗ "Draw the details" (too vague)
✗ "Sketch the preliminary outline using light strokes" (too complex)
✗ Steps that don't build on previous ones

CRITICAL: Each image_prompt must be CUMULATIVE - showing ALL previous steps plus the new element.
Step 1 shows: oval body
Step 2 shows: oval body + circle head
Step 3 shows: oval body + circle head + triangle wings
etc.

Return ONLY valid JSON in this EXACT format (no markdown, no code blocks):
{
  "steps": [
    {
      "step_number": 1,
      "title": "Draw the Body",
      "description": "Draw a big oval for the body.",
      "image_prompt": "Simple black and white line drawing showing ONLY a large oval shape in the center. Pure white background, bold black lines, minimal detail, like a coloring book."
    },
    {
      "step_number": 2,
      "title": "Add the Head",
      "description": "Add a smaller circle on top for the head.",
      "image_prompt": "Simple black and white line drawing showing a large oval body with a smaller circle attached on top for the head. Pure white background, bold black lines, minimal detail, like a coloring book. Shows the complete drawing from step 1 plus the new head."
    }
  ]
}`;

  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ text: prompt }],
    });

    // Extract text from response
    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new Error('No content in Gemini response');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.text);
    if (!textPart || !textPart.text) {
      throw new Error('No text in Gemini response');
    }

    const text = textPart.text;

    console.log('[GeminiSketch] Raw Gemini response:', text.substring(0, 200));

    // Clean up response (remove markdown code blocks if present)
    let cleanedText = text.trim();
    cleanedText = cleanedText.replace(/^```json\s*/i, '');
    cleanedText = cleanedText.replace(/^```\s*/i, '');
    cleanedText = cleanedText.replace(/\s*```$/i, '');
    cleanedText = cleanedText.trim();

    const data = JSON.parse(cleanedText);

    // Validate response
    if (!data.steps || !Array.isArray(data.steps)) {
      throw new Error('Invalid response: missing steps array');
    }

    if (data.steps.length < 3 || data.steps.length > 6) {
      throw new Error(`Invalid step count: ${data.steps.length} (must be 3-6)`);
    }

    // Validate each step
    data.steps.forEach((step: DrawingStep, index: number) => {
      if (!step.step_number || !step.title || !step.description || !step.image_prompt) {
        throw new Error(`Invalid step at index ${index}: missing required fields`);
      }
    });

    console.log('[GeminiSketch] Generated', data.steps.length, 'steps');
    return data;
  } catch (error) {
    console.error('[GeminiSketch] Error generating steps:', error);
    throw new Error(`Failed to generate drawing steps: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate a single simple sketch that kids can learn to draw
 * (Like the Gemini UI example - cute, simple, easy to copy)
 */
async function generateSimpleSketch(
  genAI: GoogleGenAI,
  input: SketchGuideInput
): Promise<string> {
  console.log('[GeminiSketch] Generating simple sketch');

  const prompt = `Create a simple sketch of a ${input.character_type} that a 5-6 year old child can learn and draw.

Character: ${input.character_name} the ${input.character_type}
${input.additional_details ? `Details: ${input.additional_details}` : ''}

CRITICAL REQUIREMENTS:
- Simple, cute cartoon-style sketch
- Black and white line drawing only
- Clean, smooth lines (hand-drawn feel, but not messy)
- Made of basic shapes (circles, ovals, simple curves)
- Minimal details - just enough to be recognizable and adorable
- Big, expressive eyes (if applicable)
- Friendly, inviting appearance
- Pure white background
- NO text, NO titles, NO instructions
- Easy enough for a young child to copy
- Think "coloring book character" style
- Cute and encouraging, not intimidating
- NORMAL, HEALTHY PROPORTIONS - not overly fat, chubby, or wide
- If description says "big", interpret as LARGE/TALL in size, NOT fat or chubby
- Maintain natural body proportions for the species/character type

STYLE REFERENCE:
Similar to children's book illustrations - simple, charming, easy to trace or copy. Like the kind of character a child would be excited to try drawing themselves.

The sketch should inspire kids to pick up a pencil and try drawing it!`;

  const imageUrl = await generateSketchImage(genAI, prompt);

  console.log('[GeminiSketch] Generated simple sketch');

  return imageUrl;
}


/**
 * Generate a single sketch image using Gemini Imagen
 */
async function generateSketchImage(
  genAI: GoogleGenAI,
  prompt: string
): Promise<string> {
  try {
    const result = await genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: prompt }],
      config: {
        responseModalities: ['image'],
        imageConfig: {
          aspectRatio: '1:1',
        },
      },
    });

    // Extract image from response
    console.log('[GeminiSketch] Full Gemini response:', JSON.stringify(result, null, 2));

    const candidates = result.candidates;
    if (!candidates || candidates.length === 0) {
      console.error('[GeminiSketch] No candidates in response');
      throw new Error('No candidates in Gemini response');
    }

    console.log('[GeminiSketch] Candidate structure:', JSON.stringify(candidates[0], null, 2));

    const parts = candidates[0].content?.parts;
    if (!parts || parts.length === 0) {
      console.error('[GeminiSketch] No parts in candidate. Content:', JSON.stringify(candidates[0].content));
      console.error('[GeminiSketch] Full candidate:', JSON.stringify(candidates[0]));
      throw new Error('No parts in Gemini response');
    }

    console.log('[GeminiSketch] Parts found:', parts.length);

    // Find the image part
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const imagePart = parts.find((p: any) => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
      // Check for text response explaining why no image
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const textPart = parts.find((p: any) => p.text);
      console.error('[GeminiSketch] No image part found. Parts:', JSON.stringify(parts));
      throw new Error(`Gemini image generation failed: ${textPart?.text || 'No image generated'}`);
    }

    // Return as base64 data URL
    const base64 = imagePart.inlineData.data;
    const mimeType = imagePart.inlineData.mimeType || 'image/png';
    console.log('[GeminiSketch] Successfully extracted image, mime:', mimeType);
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('[GeminiSketch] Error generating image:', error);
    throw new Error(`Image generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if sketch generation is available
 */
export function isSketchServiceAvailable(): boolean {
  return isGeminiAvailable() && !!process.env.GEMINI_API_KEY;
}
