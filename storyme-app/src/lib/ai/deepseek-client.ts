/**
 * DeepSeek API Client
 *
 * DeepSeek V3 is optimized for Chinese language generation
 * Cost: $0.28/M input tokens vs GPT-4o's $2.50/M (90% savings)
 *
 * API Docs: https://api-docs.deepseek.com/
 */

import OpenAI from 'openai';

/**
 * DeepSeek client - uses OpenAI-compatible API
 * DeepSeek API is compatible with OpenAI SDK
 */
export const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1',
});

/**
 * Check if DeepSeek API is configured
 */
export function isDeepSeekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY;
}

/**
 * Get appropriate model for language
 */
export function getModelForLanguage(language: 'en' | 'zh'): {
  client: OpenAI;
  model: string;
} {
  if (language === 'zh' && isDeepSeekConfigured()) {
    return {
      client: deepseek,
      model: 'deepseek-chat', // DeepSeek V3 model
    };
  }

  // Check if OpenAI is configured for English
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: 'gpt-4o',
    };
  }

  // Fallback to DeepSeek for English if no OpenAI key
  // DeepSeek handles English well too, just optimized for Chinese
  if (isDeepSeekConfigured()) {
    console.warn('Using DeepSeek for English (OPENAI_API_KEY not configured)');
    return {
      client: deepseek,
      model: 'deepseek-chat',
    };
  }

  // Last resort: throw error if no API keys configured
  throw new Error('No AI API key configured. Please set OPENAI_API_KEY or DEEPSEEK_API_KEY in .env.local');
}

/**
 * Log model usage for debugging
 */
export function logModelUsage(
  language: 'en' | 'zh',
  model: string,
  usage?: any
) {
  console.log(`🤖 AI Model: ${model} (language: ${language})`);
  if (usage) {
    console.log(`📊 Tokens: ${usage.total_tokens || 'unknown'}`);
    console.log(`💰 Cost estimate: ${language === 'zh' ? '90% savings with DeepSeek' : 'OpenAI standard pricing'}`);
  }
}
