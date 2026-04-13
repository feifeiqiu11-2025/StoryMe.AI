/**
 * Scan Script Service
 *
 * Uses Gemini Vision to extract handwritten text from images.
 * Two modes:
 * - "freeform": Free-form handwriting on paper/napkin — plain OCR + light cleanup
 * - "worksheet": Structured teacher worksheet/template — extracts fields and maps to scenes
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_MODEL = 'gemini-2.5-flash';

export interface ScanScriptResult {
  extractedText: string;
  scenes: string[];
  confidence: 'high' | 'medium' | 'low';
  detectedLanguage?: string;
}

const FREEFORM_PROMPT = `You are an OCR assistant for a children's storybook app. A child or parent has taken a photo of handwritten story scenes on paper, a napkin, or notebook.

Your task:
1. Read ALL handwritten text in the image carefully
2. Convert it to clean, typed text
3. Preserve the child's original wording and voice — do NOT rewrite or embellish
4. Fix only obvious spelling errors (e.g., "teh" → "the") but keep kid-style phrasing
5. Separate distinct scenes onto their own lines (one scene per line)
6. If numbered or bulleted, remove the numbering — just output the text lines

Return ONLY raw JSON (no markdown code blocks):
{
  "extractedText": "the full cleaned text as a single string with newlines between scenes",
  "scenes": ["scene 1 text", "scene 2 text", ...],
  "confidence": "high" | "medium" | "low",
  "detectedLanguage": "en" or "zh" or other ISO 639-1 code
}

Confidence guide:
- "high": text is clearly legible, you are very confident in the reading
- "medium": some words are hard to read, you made reasonable guesses
- "low": significant portions are illegible, output may be incomplete

If the image contains NO readable text, return:
{
  "extractedText": "",
  "scenes": [],
  "confidence": "low",
  "detectedLanguage": null
}`;

const WORKSHEET_PROMPT = `You are an OCR assistant for a children's storybook app. A teacher has taken a photo of a filled-in story worksheet/template used during a workshop.

The worksheet likely has structured fields such as:
- Character name(s)
- Story setting / location
- Scene descriptions (numbered or in boxes)
- Story theme or lesson

Your task:
1. Read ALL handwritten text in the worksheet
2. Extract the scene descriptions or story content
3. Map them into individual scene lines (one scene per line)
4. Preserve the child's original wording — do NOT rewrite
5. Fix only obvious spelling errors
6. Ignore printed template text (headers, instructions) — only extract handwritten content

Return ONLY raw JSON (no markdown code blocks):
{
  "extractedText": "the full cleaned text as a single string with newlines between scenes",
  "scenes": ["scene 1 text", "scene 2 text", ...],
  "confidence": "high" | "medium" | "low",
  "detectedLanguage": "en" or "zh" or other ISO 639-1 code
}

Confidence guide:
- "high": text is clearly legible, you are very confident
- "medium": some words are hard to read, you made reasonable guesses
- "low": significant portions are illegible

If the image contains NO readable handwritten text, return:
{
  "extractedText": "",
  "scenes": [],
  "confidence": "low",
  "detectedLanguage": null
}`;

export async function scanScriptFromImage(
  imageBase64: string,
  mimeType: string,
  mode: 'freeform' | 'worksheet' = 'freeform',
  languageHint?: string
): Promise<ScanScriptResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const genAI = new GoogleGenAI({ apiKey });

  const prompt = mode === 'worksheet' ? WORKSHEET_PROMPT : FREEFORM_PROMPT;
  const languageSuffix = languageHint
    ? `\n\nHint: the text is likely written in ${languageHint}. Prioritize reading it in that language.`
    : '';

  const result = await genAI.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { text: prompt + languageSuffix },
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ],
    config: {
      temperature: 0.2,
      maxOutputTokens: 4096,
    },
  });

  // Extract text from response
  const candidates = result.candidates;
  if (!candidates || candidates.length === 0) {
    throw new Error('No response from Gemini Vision');
  }

  const parts = candidates[0].content?.parts;
  if (!parts) {
    throw new Error('No content in Gemini Vision response');
  }

  const textPart = parts.find((p: { text?: string }) => p.text);
  if (!textPart?.text) {
    throw new Error('No text in Gemini Vision response');
  }

  // Clean markdown code blocks if present
  let content = textPart.text.trim();
  content = content.replace(/^```json\s*/i, '');
  content = content.replace(/^```\s*/i, '');
  content = content.replace(/\s*```$/i, '');
  content = content.trim();

  // Extract JSON object if embedded in other text
  if (!content.startsWith('{')) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
  }

  let parsed: ScanScriptResult;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('[ScanScript] Failed to parse JSON:', content.substring(0, 500));
    throw new Error('Failed to parse scan result');
  }

  // Validate and normalize
  if (!parsed.extractedText && (!parsed.scenes || parsed.scenes.length === 0)) {
    return {
      extractedText: '',
      scenes: [],
      confidence: 'low',
      detectedLanguage: parsed.detectedLanguage || undefined,
    };
  }

  // Ensure scenes array exists and is clean
  if (!Array.isArray(parsed.scenes)) {
    parsed.scenes = parsed.extractedText
      ? parsed.extractedText.split('\n').filter((line: string) => line.trim().length > 0)
      : [];
  }

  // Rebuild extractedText from scenes if needed
  if (!parsed.extractedText && parsed.scenes.length > 0) {
    parsed.extractedText = parsed.scenes.join('\n');
  }

  return {
    extractedText: parsed.extractedText || '',
    scenes: parsed.scenes,
    confidence: parsed.confidence || 'medium',
    detectedLanguage: parsed.detectedLanguage || undefined,
  };
}
