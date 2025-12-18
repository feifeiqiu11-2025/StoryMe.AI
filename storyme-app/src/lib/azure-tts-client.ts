/**
 * Azure Text-to-Speech Client for StoryMe.AI
 *
 * Generates audio narration for children's stories using Azure Neural TTS.
 * - English: Uses en-US-AnaNeural (child voice) for authentic kid storytelling
 * - Chinese: Uses zh-CN-XiaoxiaoNeural (晓晓) and other kid-friendly voices
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

type VoiceConfig = { voice: string; rate: string; pitch: string };

// English voice configuration based on story tone
// Using en-US-AnaNeural (child voice) as primary for authentic kid storytelling
// Fallback to JennyNeural for certain tones that need more expressiveness
const ENGLISH_VOICE_CONFIG: Record<string, VoiceConfig> = {
  playful: { voice: 'en-US-AnaNeural', rate: '-10%', pitch: '+5%' },       // Child voice - cheerful
  educational: { voice: 'en-US-AnaNeural', rate: '-15%', pitch: '0%' },    // Child voice - clear for learning
  adventurous: { voice: 'en-US-AnaNeural', rate: '-5%', pitch: '+3%' },    // Child voice - excited
  adventure: { voice: 'en-US-AnaNeural', rate: '-5%', pitch: '+3%' },      // Alias
  calming: { voice: 'en-US-AnaNeural', rate: '-20%', pitch: '-5%' },       // Child voice - soft, bedtime
  gentle: { voice: 'en-US-AnaNeural', rate: '-20%', pitch: '-5%' },        // Alias
  mysterious: { voice: 'en-US-AnaNeural', rate: '-15%', pitch: '-3%' },    // Child voice - whispery
  mystery: { voice: 'en-US-AnaNeural', rate: '-15%', pitch: '-3%' },       // Alias
  silly: { voice: 'en-US-AnaNeural', rate: '0%', pitch: '+8%' },           // Child voice - fun, animated
  brave: { voice: 'en-US-AnaNeural', rate: '-10%', pitch: '0%' },          // Child voice - confident
  friendly: { voice: 'en-US-AnaNeural', rate: '-10%', pitch: '+3%' },      // Child voice - warm
  default: { voice: 'en-US-AnaNeural', rate: '-15%', pitch: '0%' },        // Default: Child voice at slower pace
};

// Chinese voice configuration based on story tone
// Using kid-friendly neural voices for children's stories
const CHINESE_VOICE_CONFIG: Record<string, VoiceConfig> = {
  playful: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-10%', pitch: '+5%' },      // 晓晓 - Cheerful, kid-friendly
  educational: { voice: 'zh-CN-XiaoyiNeural', rate: '-15%', pitch: '0%' },     // 晓伊 - Clear, warm
  adventurous: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-5%', pitch: '+3%' },   // 晓晓 - Energetic
  adventure: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-5%', pitch: '+3%' },     // Alias
  calming: { voice: 'zh-CN-XiaohanNeural', rate: '-20%', pitch: '-5%' },       // 晓涵 - Soft, gentle
  gentle: { voice: 'zh-CN-XiaohanNeural', rate: '-20%', pitch: '-5%' },        // Alias
  mysterious: { voice: 'zh-CN-XiaochenNeural', rate: '-15%', pitch: '-3%' },   // 晓辰 - Calm, storytelling
  mystery: { voice: 'zh-CN-XiaochenNeural', rate: '-15%', pitch: '-3%' },      // Alias
  silly: { voice: 'zh-CN-XiaoxiaoNeural', rate: '0%', pitch: '+8%' },          // 晓晓 - Fun, animated
  brave: { voice: 'zh-CN-YunxiNeural', rate: '-10%', pitch: '0%' },            // 云希 - Confident male voice
  friendly: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-10%', pitch: '+3%' },     // 晓晓 - Warm, friendly
  default: { voice: 'zh-CN-XiaoxiaoNeural', rate: '-10%', pitch: '0%' },       // Default: 晓晓 (most kid-friendly)
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

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${xmlLang}">
  <voice name="${voiceConfig.voice}">
    <prosody rate="${voiceConfig.rate}" pitch="${voiceConfig.pitch}">
      ${cleanText}
    </prosody>
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
