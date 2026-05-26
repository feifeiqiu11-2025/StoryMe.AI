/**
 * Mix service — given an AudioLayers spec, produces a single rendered MP3.
 *
 * Pure function in spirit: input layers → output buffer. No DB writes, no
 * storage uploads — callers handle persistence. Layers reference remote
 * audio URLs (vocal upload, SFX library, ElevenLabs cache); we fetch each
 * to a temp file, build an FFmpeg filter graph, run, and read the result.
 *
 * Pipeline per stream:
 *   - vocal: atrim (if trim) → volume
 *   - music: adelay (startSec) → atrim (clamp to durationSec) → volume
 *   - effect: adelay (startSec) → atrim (clamp to durationSec) → volume
 *   - amix all → out
 *
 * Phase 2b ships without sidechain ducking — default music volume (-18 dB)
 * keeps vocals intelligible. Ducking can drop in later as a filter swap
 * without touching the layer schema.
 */

import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { AudioLayers, DEFAULT_VOLUMES } from './layers.types';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

interface PreparedInput {
  path: string;
  /** FFmpeg input index (-i N). */
  index: number;
}

async function downloadToTemp(url: string, suffix: string): Promise<string> {
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = join(tmpdir(), `mix-${tempId}-${suffix}.mp3`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path, buffer);
  return path;
}

function vocalFilter(label: string, layer: AudioLayers['vocal']): string {
  const ops: string[] = [];
  if (typeof layer.trimStartSec === 'number' || typeof layer.trimEndSec === 'number') {
    const start = layer.trimStartSec ?? 0;
    const end = layer.trimEndSec ?? layer.durationSec;
    ops.push(`atrim=start=${start}:end=${end}`, `asetpts=PTS-STARTPTS`);
  }
  const volDb = layer.volumeDb ?? DEFAULT_VOLUMES.vocal;
  ops.push(`volume=${volDb}dB`);
  return `[0:a]${ops.join(',')}[${label}]`;
}

function timedLayerFilter(
  inputIdx: number,
  label: string,
  startSec: number,
  durationSec: number,
  volumeDb: number,
  sourceOffsetSec: number = 0,
): string {
  const delayMs = Math.round(startSec * 1000);
  // sourceOffsetSec > 0: skip the source's first N seconds via an inner
  //   atrim+asetpts, THEN delay, THEN clamp the audible length.
  // sourceOffsetSec = 0 (the common case): just delay + clamp.
  const sourceSlice = sourceOffsetSec > 0
    ? `atrim=start=${sourceOffsetSec},asetpts=PTS-STARTPTS,`
    : '';
  return `[${inputIdx}:a]${sourceSlice}adelay=${delayMs}|${delayMs}:all=1,atrim=duration=${startSec + durationSec},volume=${volumeDb}dB[${label}]`;
}

export async function mixLayersToMp3(layers: AudioLayers): Promise<Buffer> {
  const tempPaths: string[] = [];
  const outputPath = join(tmpdir(), `mix-out-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.mp3`);

  try {
    // Download vocal first (input 0).
    const vocalPath = await downloadToTemp(layers.vocal.url, 'vocal');
    tempPaths.push(vocalPath);

    const inputs: PreparedInput[] = [{ path: vocalPath, index: 0 }];

    // Download music + effects sequentially. Could parallelize for speed,
    // but serial is simpler and the typical page has <5 layers.
    for (const m of layers.music) {
      const path = await downloadToTemp(m.url, `music-${m.id}`);
      tempPaths.push(path);
      inputs.push({ path, index: inputs.length });
    }
    for (const e of layers.effects) {
      const path = await downloadToTemp(e.url, `effect-${e.id}`);
      tempPaths.push(path);
      inputs.push({ path, index: inputs.length });
    }

    // Build filter_complex graph.
    const filters: string[] = [vocalFilter('vocal_out', layers.vocal)];
    const mixInputs: string[] = ['[vocal_out]'];

    let musicCursor = 1;
    for (const m of layers.music) {
      const label = `music_${m.id}_out`;
      filters.push(
        timedLayerFilter(musicCursor, label, m.startSec, m.durationSec, m.volumeDb ?? DEFAULT_VOLUMES.music),
      );
      mixInputs.push(`[${label}]`);
      musicCursor++;
    }
    let effectCursor = musicCursor;
    for (const e of layers.effects) {
      const label = `effect_${e.id}_out`;
      filters.push(
        timedLayerFilter(
          effectCursor,
          label,
          e.startSec,
          e.durationSec,
          e.volumeDb ?? DEFAULT_VOLUMES.effect,
          e.sourceOffsetSec ?? 0,
        ),
      );
      mixInputs.push(`[${label}]`);
      effectCursor++;
    }

    // amix all streams. normalize=0 keeps per-stream volumes as authored
    // (default 1 would auto-attenuate, making the mix quieter as layers add).
    filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=longest:normalize=0[mixed]`);

    // Fast path: vocal-only with no trim/volume change — just transcode
    // through. Avoids the amix graph entirely. Treats trim/volume as
    // "edited" because they require the filter to run.
    const vocalIsUntouched =
      layers.music.length === 0
      && layers.effects.length === 0
      && layers.vocal.trimStartSec === undefined
      && layers.vocal.trimEndSec === undefined
      && (layers.vocal.volumeDb === undefined || layers.vocal.volumeDb === 0);

    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg();
      for (const input of inputs) cmd.input(input.path);
      if (vocalIsUntouched) {
        cmd.audioCodec('copy');
      } else {
        cmd
          .complexFilter(filters, ['mixed'])
          .audioCodec('libmp3lame')
          .audioBitrate('128k');
      }
      cmd
        .format('mp3')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outputPath);
    });

    const out = await readFile(outputPath);
    return out;
  } finally {
    for (const p of tempPaths) {
      try { await unlink(p); } catch { /* ignore */ }
    }
    try { await unlink(outputPath); } catch { /* ignore */ }
  }
}
