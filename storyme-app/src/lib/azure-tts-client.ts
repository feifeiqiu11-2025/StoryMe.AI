/**
 * Azure Text-to-Speech Client for StoryMe.AI
 *
 * Used specifically for Chinese audio generation with native Chinese voices.
 * English audio continues to use OpenAI TTS.
 */

import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

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
   * Synthesize Chinese text to speech
   * @param text - Chinese text to synthesize
   * @param tone - Story tone for voice selection
   * @returns Audio buffer (MP3 format)
   */
  async synthesize(text: string, tone: string = 'default'): Promise<AzureTTSResult> {
    if (!this.isAvailable()) {
      throw new Error('Azure TTS is not configured. Please set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
    }

    const voiceConfig = CHINESE_VOICE_CONFIG[tone] || CHINESE_VOICE_CONFIG.default;

    return new Promise((resolve, reject) => {
      try {
        const speechConfig = sdk.SpeechConfig.fromSubscription(
          this.config.subscriptionKey,
          this.config.region
        );

        // Use MP3 format: 16kHz, 128kbps, Mono - compatible with mobile apps
        speechConfig.speechSynthesisOutputFormat =
          sdk.SpeechSynthesisOutputFormat.Audio16Khz128KBitRateMonoMp3;

        // Create synthesizer without audio output (we capture the buffer)
        const synthesizer = new sdk.SpeechSynthesizer(speechConfig, undefined);

        // Build SSML for better control of voice, rate, and pitch
        const ssml = this.buildSSML(text, voiceConfig);

        console.log(`[Azure TTS] Synthesizing Chinese audio with voice: ${voiceConfig.voice}`);

        synthesizer.speakSsmlAsync(
          ssml,
          (result) => {
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              const audioBuffer = Buffer.from(result.audioData);
              const durationMs = result.audioDuration / 10000; // Convert from 100ns to ms

              console.log(`[Azure TTS] Successfully generated ${audioBuffer.length} bytes, duration: ${Math.round(durationMs)}ms`);

              synthesizer.close();
              resolve({
                audioBuffer,
                durationMs,
              });
            } else {
              synthesizer.close();
              reject(new Error(`Azure TTS synthesis failed: ${result.errorDetails || 'Unknown error'}`));
            }
          },
          (error) => {
            synthesizer.close();
            reject(new Error(`Azure TTS error: ${error}`));
          }
        );
      } catch (error) {
        reject(error);
      }
    });
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

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="zh-CN">
        <voice name="${voiceConfig.voice}">
          <prosody rate="${voiceConfig.rate}" pitch="${voiceConfig.pitch}">
            ${cleanText}
          </prosody>
        </voice>
      </speak>
    `.trim();
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
