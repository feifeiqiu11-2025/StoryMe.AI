/**
 * Azure Text-to-Speech Client for StoryMe.AI
 *
 * Generates audio narration for children's stories using Azure Neural TTS.
 * - English: Uses en-US-Ava:DragonHDLatestNeural (HD voice - warm, expressive female)
 * - Chinese: Uses zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural with "story" style
 *
 * Uses REST API instead of SDK for serverless compatibility (Vercel).
 * Reference: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech
 */

export interface AzureTTSResult {
  audioBuffer: Buffer;
  durationMs: number;
}

interface AzureTTSConfig {
  subscriptionKey: string;
  region: string;
}

type VoiceConfig = { voice: string; rate: string; pitch: string; style?: string };

// English voice configuration based on story tone
// Using en-US-Ava:DragonHDLatestNeural - HD quality voice with:
// - Warm, expressive female voice
// - Clear pronunciation with natural rhythm
// - Great for storytelling
const ENGLISH_VOICE_CONFIG: Record<string, VoiceConfig> = {
  playful: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-15%', pitch: '+3%' },       // HD - cheerful
  educational: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-20%', pitch: '0%' },    // HD - clear for learning
  adventurous: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-15%', pitch: '+2%' },   // HD - excited
  adventure: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-15%', pitch: '+2%' },     // Alias
  calming: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-25%', pitch: '-3%' },       // HD - soft, bedtime
  gentle: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-25%', pitch: '-3%' },        // Alias
  mysterious: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-20%', pitch: '-2%' },    // HD - intriguing
  mystery: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-20%', pitch: '-2%' },       // Alias
  silly: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-10%', pitch: '+5%' },         // HD - fun, animated
  brave: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-15%', pitch: '0%' },          // HD - confident
  friendly: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-15%', pitch: '+2%' },      // HD - warm
  default: { voice: 'en-US-Ava:DragonHDLatestNeural', rate: '-20%', pitch: '0%' },        // Default: HD at comfortable pace
};

// Chinese voice configuration based on story tone
// Using zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural - HD voice with "story" style:
// - Expressive storytelling with natural rhythm
// - Clear pronunciation
// - Authentic Chinese voice
const CHINESE_VOICE_CONFIG: Record<string, VoiceConfig> = {
  playful: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-15%', pitch: '+3%', style: 'cheerful' },     // HD - cheerful
  educational: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-20%', pitch: '0%', style: 'story' },     // HD - story mode
  adventurous: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-15%', pitch: '+2%', style: 'excited' },  // HD - excited
  adventure: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-15%', pitch: '+2%', style: 'excited' },    // Alias
  calming: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-25%', pitch: '-3%', style: 'affectionate' }, // HD - gentle
  gentle: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-25%', pitch: '-3%', style: 'affectionate' },  // Alias
  mysterious: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-20%', pitch: '-2%', style: 'whisper' },   // HD - whisper
  mystery: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-20%', pitch: '-2%', style: 'whisper' },      // Alias
  silly: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-10%', pitch: '+5%', style: 'cheerful' },       // HD - fun
  brave: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-15%', pitch: '0%', style: 'story' },           // HD - confident
  friendly: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-15%', pitch: '+2%', style: 'affectionate' },// HD - warm
  default: { voice: 'zh-CN-Xiaoxiao2:DragonHDFlashLatestNeural', rate: '-20%', pitch: '0%', style: 'story' },         // Default: HD story mode
};

/**
 * Azure TTS Client for story audio generation
 * Uses REST API for serverless compatibility (Vercel)
 */
export class AzureTTSClient {
  private config: AzureTTSConfig;

  constructor(config: AzureTTSConfig) {
    this.config = config;
  }

  /**
   * Check if Azure TTS is available (has valid credentials)
   */
  isAvailable(): boolean {
    return !!(this.config.subscriptionKey && this.config.region);
  }

  /**
   * Synthesize text to speech using Azure REST API
   * @param text - Text to synthesize
   * @param tone - Story tone for voice selection
   * @param language - Language code: 'en' for English, 'zh' for Chinese
   * @returns Audio buffer (MP3 format)
   */
  async synthesize(text: string, tone: string = 'default', language: 'en' | 'zh' = 'zh'): Promise<AzureTTSResult> {
    if (!this.isAvailable()) {
      throw new Error('Azure TTS is not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    }

    const voiceConfig = language === 'en'
      ? (ENGLISH_VOICE_CONFIG[tone] || ENGLISH_VOICE_CONFIG.default)
      : (CHINESE_VOICE_CONFIG[tone] || CHINESE_VOICE_CONFIG.default);

    const xmlLang = language === 'en' ? 'en-US' : 'zh-CN';
    const ssml = this.buildSSML(text, voiceConfig, xmlLang);

    console.log(`[Azure TTS REST] Synthesizing ${language.toUpperCase()} audio with voice: ${voiceConfig.voice}`);
    console.log(`[Azure TTS REST] Region: ${this.config.region}, Text length: ${text.length}, Tone: ${tone}`);

    const endpoint = `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.config.subscriptionKey,
          'Content-Type': 'application/ssml+xml',
          // MP3 format: 16kHz, 128kbps - compatible with mobile apps
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
          'User-Agent': 'StoryMeAI-TTS',
        },
        body: ssml,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Azure TTS REST] API error: ${response.status} - ${errorText}`);
        throw new Error(`Azure TTS API error: ${response.status} - ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // Estimate duration based on MP3 bitrate (128kbps = 16KB/s)
      const estimatedDurationMs = (audioBuffer.length / 16000) * 1000;

      console.log(`[Azure TTS REST] Successfully generated ${audioBuffer.length} bytes, estimated duration: ${Math.round(estimatedDurationMs)}ms`);

      return {
        audioBuffer,
        durationMs: estimatedDurationMs,
      };
    } catch (error: any) {
      console.error(`[Azure TTS REST] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Build SSML for speech synthesis
   */
  private buildSSML(text: string, voiceConfig: VoiceConfig, xmlLang: string): string {
    // Escape XML special characters
    const cleanText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Add mstts namespace if using style
    const msttsNs = voiceConfig.style ? ' xmlns:mstts="http://www.w3.org/2001/mstts"' : '';
    const styleOpen = voiceConfig.style ? `<mstts:express-as style="${voiceConfig.style}">` : '';
    const styleClose = voiceConfig.style ? '</mstts:express-as>' : '';

    // Volume boost for louder, clearer audio output
    // Azure SSML supports: silent, x-soft, soft, medium, loud, x-loud, or percentage like +20%
    const volume = '+30%';

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"${msttsNs} xml:lang="${xmlLang}">
  <voice name="${voiceConfig.voice}">
    ${styleOpen}
    <prosody rate="${voiceConfig.rate}" pitch="${voiceConfig.pitch}" volume="${volume}">
      ${cleanText}
    </prosody>
    ${styleClose}
  </voice>
</speak>`;
  }
}

// Singleton instance
let azureTTSClient: AzureTTSClient | null = null;

/**
 * Get or create Azure TTS client singleton
 */
export function getAzureTTSClient(): AzureTTSClient {
  if (!azureTTSClient) {
    azureTTSClient = new AzureTTSClient({
      subscriptionKey: process.env.AZURE_SPEECH_KEY || '',
      region: process.env.AZURE_SPEECH_REGION || '',
    });
  }
  return azureTTSClient;
}

/**
 * Check if Azure TTS is available
 */
export function isAzureTTSAvailable(): boolean {
  return getAzureTTSClient().isAvailable();
}
