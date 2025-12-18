/**
 * Azure Text-to-Speech Client for StoryMe.AI
 *
 * Used specifically for Chinese audio generation with native Chinese voices.
 * English audio continues to use OpenAI TTS.
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

// Chinese voice configuration based on story tone
// Using kid-friendly neural voices for children's stories
const CHINESE_VOICE_CONFIG: Record<string, { voice: string; rate: string; pitch: string }> = {
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
 * Azure TTS Client for Chinese audio generation
 * Uses REST API for serverless compatibility
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
   * Synthesize Chinese text to speech using Azure REST API
   * @param text - Chinese text to synthesize
   * @param tone - Story tone for voice selection
   * @returns Audio buffer (MP3 format)
   */
  async synthesize(text: string, tone: string = 'default'): Promise<AzureTTSResult> {
    if (!this.isAvailable()) {
      throw new Error('Azure TTS is not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    }

    const voiceConfig = CHINESE_VOICE_CONFIG[tone] || CHINESE_VOICE_CONFIG.default;
    const ssml = this.buildSSML(text, voiceConfig);

    console.log(`[Azure TTS REST] Synthesizing Chinese audio with voice: ${voiceConfig.voice}`);
    console.log(`[Azure TTS REST] Region: ${this.config.region}, Text length: ${text.length}`);

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
   * Build SSML for Chinese speech synthesis
   */
  private buildSSML(text: string, voiceConfig: { voice: string; rate: string; pitch: string }): string {
    // Escape XML special characters
    const cleanText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
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
