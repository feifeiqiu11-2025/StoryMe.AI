/**
 * Generic Caption Translation Service
 *
 * Translates English captions to any supported secondary language.
 * Routes to the appropriate AI model:
 * - Chinese (zh): DeepSeek V3 (optimized for Chinese, 90% cost savings)
 * - Korean (ko): GPT-4o or DeepSeek fallback
 * - Future languages: extendable via TRANSLATION_PROMPTS
 */

import { getModelForLanguage, logModelUsage } from './deepseek-client';
import { type SecondaryLanguage, getLanguageConfig } from '../config/languages';

interface TranslationContext {
  readingLevel?: number;
  storyTone?: string;
}

// System prompts per target language
const TRANSLATION_SYSTEM_PROMPTS: Record<SecondaryLanguage, string> = {
  zh: '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。',
  ko: '당신은 전문 아동 동화 번역가입니다. 영어 동화를 생동감 있고 아이들에게 적합한 한국어로 번역하는 데 능숙합니다.',
};

// User prompt template per target language
const TRANSLATION_USER_PROMPTS: Record<SecondaryLanguage, (captions: string) => string> = {
  zh: (captions) => `Translate the following English children's story captions to Chinese. Keep the same playful, age-appropriate tone. Return ONLY the translations, one per line, in the same order.

English Captions:
${captions}

Chinese Translations:`,

  ko: (captions) => `Translate the following English children's story captions to Korean. Keep the same playful, age-appropriate tone suitable for children aged 5-8. Return ONLY the translations, one per line, in the same order.

English Captions:
${captions}

Korean Translations:`,
};

/**
 * Translate an array of English captions to the target secondary language.
 * Returns translations in the same order. Falls back to original English on failure.
 */
export async function translateCaptions(
  captions: string[],
  targetLanguage: SecondaryLanguage,
  context?: TranslationContext,
): Promise<string[]> {
  const config = getLanguageConfig(targetLanguage);
  if (!config) {
    console.warn(`Unsupported translation target: ${targetLanguage}, returning originals`);
    return captions;
  }

  console.log(`🌏 Translating ${captions.length} captions to ${config.label}...`);

  // For Chinese, use DeepSeek via getModelForLanguage('zh')
  // For Korean and others, use the English model (GPT-4o) which handles multilingual well
  const modelLanguage = targetLanguage === 'zh' ? 'zh' : 'en';
  const { client, model } = getModelForLanguage(modelLanguage as 'en' | 'zh');

  const systemPrompt = TRANSLATION_SYSTEM_PROMPTS[targetLanguage];
  const captionsText = captions.join('\n\n');
  const userPrompt = TRANSLATION_USER_PROMPTS[targetLanguage](captionsText);

  const completion = await client.chat.completions.create({
    model,
    max_tokens: 2048,
    temperature: 0.5,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const translationsText = completion.choices[0]?.message?.content || '';
  const translations = translationsText.trim().split('\n').filter((t: string) => t.trim());

  console.log(`✓ Generated ${translations.length} ${config.label} translations`);
  logModelUsage(modelLanguage as 'en' | 'zh', model, completion.usage);

  // Map translations back to captions array, falling back to English if count mismatch
  return captions.map((original, index) => translations[index]?.trim() || original);
}
