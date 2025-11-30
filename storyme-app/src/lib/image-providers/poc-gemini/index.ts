/**
 * Gemini Image Generation POC
 *
 * Export the client for use in API routes if POC is successful.
 */

export { GeminiImageClient, getGeminiClient } from './gemini-client';
export type {
  CharacterReference,
  GeminiGenerateParams,
  GeminiGenerateResult,
} from './gemini-client';
