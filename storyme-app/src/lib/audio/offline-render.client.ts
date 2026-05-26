/**
 * Offline audio rendering for the Recorder's "Delete cut" action.
 *
 * Given a source vocal blob + a list of segments (in source-time), renders
 * the concatenated active audio into a new shorter blob. Used when the
 * user destructively commits a cut: the gap audio is physically removed
 * from the source so the editing project starts fresh from the new (shorter)
 * recording.
 *
 * Implementation: Web Audio's OfflineAudioContext schedules each segment
 * as its own AudioBufferSourceNode, plays them back-to-back, and produces
 * a single AudioBuffer. We then encode that buffer to WAV (16-bit PCM)
 * because in-browser MP3 encoding is heavy and the server transcodes any
 * format on its next upload anyway.
 *
 * Browser support: Chrome/Firefox/Edge full. iOS Safari has occasional
 * quirks around AudioContext.decodeAudioData with WebM — the caller
 * surfaces decode failures so the user can retry or skip the destructive
 * step.
 */

import type { VocalSegment } from './layers.types';

/** Concatenate the given segments of a source blob into a new WAV blob.
 *  Returns the new blob and its duration in seconds. */
export async function renderSegmentsToWav(
  sourceBlob: Blob,
  segments: VocalSegment[],
): Promise<{ blob: Blob; durationSec: number }> {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
    throw new Error('Offline render requires a browser AudioContext');
  }
  if (segments.length === 0) {
    throw new Error('At least one segment is required');
  }

  // Decode source.
  const tempCtx = new AudioContext();
  let sourceBuffer: AudioBuffer;
  try {
    const arrayBuf = await sourceBlob.arrayBuffer();
    sourceBuffer = await tempCtx.decodeAudioData(arrayBuf.slice(0));
  } finally {
    void tempCtx.close().catch(() => undefined);
  }

  const totalDuration = segments.reduce((sum, s) => sum + Math.max(0, s.endSec - s.startSec), 0);
  if (totalDuration <= 0.01) {
    throw new Error('Resulting audio would be empty');
  }

  const sampleRate = sourceBuffer.sampleRate;
  const numChannels = sourceBuffer.numberOfChannels;
  const totalSamples = Math.max(1, Math.ceil(totalDuration * sampleRate));
  const offlineCtx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);

  let mixCursor = 0;
  for (const seg of segments) {
    const segDur = Math.max(0, seg.endSec - seg.startSec);
    if (segDur <= 0) continue;
    const src = offlineCtx.createBufferSource();
    src.buffer = sourceBuffer;
    src.connect(offlineCtx.destination);
    src.start(mixCursor, seg.startSec, segDur);
    mixCursor += segDur;
  }

  const rendered = await offlineCtx.startRendering();
  const blob = audioBufferToWav(rendered);
  return { blob, durationSec: rendered.duration };
}

/** Encode an AudioBuffer as a 16-bit PCM WAV blob. Standard RIFF header
 *  followed by interleaved little-endian samples. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const samples = buffer.length;
  const bitsPerSample = 16;
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples * blockAlign;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Pre-cache channel data so we don't re-fetch arrays per sample.
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channelData.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < samples; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channelData[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
