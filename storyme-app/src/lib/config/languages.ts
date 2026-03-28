/**
 * Language Configuration
 * Central config for all supported secondary languages.
 * Adding a new language = adding one entry here + voice config in azure-tts-client.ts
 */

export type SecondaryLanguage = 'zh' | 'ko';

export interface LanguageConfig {
  code: SecondaryLanguage;
  label: string;               // "Chinese", "Korean"
  nativeLabel: string;          // "中文", "한국어"
  locale: string;               // "zh-CN", "ko-KR" (for TTS SSML xml:lang)
  fontFamily: string;           // "Noto Sans SC", "Noto Sans KR"
  needsCJKFont: boolean;        // true for zh, ko, ja — affects PDF rendering
  translationModel: 'deepseek' | 'gemini';  // which AI model for EN→X translation
}

export const SUPPORTED_SECONDARY_LANGUAGES: Record<SecondaryLanguage, LanguageConfig> = {
  zh: {
    code: 'zh',
    label: 'Chinese',
    nativeLabel: '中文',
    locale: 'zh-CN',
    fontFamily: 'Noto Sans SC',
    needsCJKFont: true,
    translationModel: 'deepseek',
  },
  ko: {
    code: 'ko',
    label: 'Korean',
    nativeLabel: '한국어',
    locale: 'ko-KR',
    fontFamily: 'Noto Sans KR',
    needsCJKFont: true,
    translationModel: 'gemini',
  },
};

/**
 * Get language config by code. Returns undefined for unsupported languages.
 */
export function getLanguageConfig(code: string | null | undefined): LanguageConfig | undefined {
  if (!code) return undefined;
  return SUPPORTED_SECONDARY_LANGUAGES[code as SecondaryLanguage];
}

/**
 * Get human-readable label for a language code.
 * Returns the code itself as fallback for unknown languages.
 */
export function getLanguageLabel(code: string | null | undefined): string {
  if (!code) return '';
  const config = getLanguageConfig(code);
  return config ? config.label : code.toUpperCase();
}

/**
 * Get TTS locale for a language code (e.g., 'zh' → 'zh-CN', 'ko' → 'ko-KR').
 * Falls back to 'en-US' for unknown languages.
 */
export function getLocaleForLanguage(code: string): string {
  if (code === 'en') return 'en-US';
  const config = getLanguageConfig(code);
  return config ? config.locale : 'en-US';
}

/**
 * Get font family for a language code (for PDF rendering).
 * Returns undefined for Latin-script languages that use default fonts.
 */
export function getFontForLanguage(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  const config = getLanguageConfig(code);
  return config?.fontFamily;
}

/**
 * Check if a language code is a supported secondary language.
 */
export function isSupportedSecondaryLanguage(code: string | null | undefined): code is SecondaryLanguage {
  if (!code) return false;
  return code in SUPPORTED_SECONDARY_LANGUAGES;
}

/**
 * Get all supported secondary languages as an array for UI dropdowns.
 */
export function getSecondaryLanguageOptions(): Array<{ code: SecondaryLanguage; label: string; nativeLabel: string }> {
  return Object.values(SUPPORTED_SECONDARY_LANGUAGES).map(({ code, label, nativeLabel }) => ({
    code,
    label,
    nativeLabel,
  }));
}
