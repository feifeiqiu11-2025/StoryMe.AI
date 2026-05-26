/**
 * POST /api/v1/audio-pages/[id]/shrink-source
 *
 * Server-side destructive delete for voice editing. Takes the current
 * draft_vocal_url, FFmpeg-renders ONLY the given keepSegments back-to-
 * back into a new shorter MP3, replaces draft_vocal_url, and collapses
 * draft_layers.vocal.segments to a single full-source segment.
 *
 * Why server-side: client-side OfflineAudioContext + WAV worked fine in
 * memory but produced a different blob from what the server has at
 * draft_vocal_url. After a delete, the persisted source and the layer
 * spec would disagree — next session would resurrect the deleted audio.
 * Doing this on the server keeps the persisted draft authoritative.
 *
 * Prerequisite: a draft must already exist (draft_vocal_url + draft_layers).
 * The client lazily calls /save-draft first if the page hasn't been
 * persisted yet.
 *
 * Body: { keepSegments: [{ startSec, endSec }, ...] }
 * Response: { draft_vocal_url, durationSec, segments: [{0, durationSec}] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { VocalSegmentSchema, type AudioLayers, type VocalSegment } from '@/lib/audio/layers.types';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { writeFile, unlink, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);
export const maxDuration = 60;

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({
  keepSegments: z.array(VocalSegmentSchema).min(1),
});
const STORAGE_BUCKET = 'story-audio-files';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: audioPageId } = ParamsSchema.parse(await params);
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    const { keepSegments } = BodySchema.parse(body);

    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: page, error: pageError } = await supabase
      .from('story_audio_pages')
      .select('id, project_id, page_number, draft_vocal_url, draft_layers, projects!inner(user_id)')
      .eq('id', audioPageId)
      .single<{
        id: string;
        project_id: string;
        page_number: number;
        draft_vocal_url: string | null;
        draft_layers: AudioLayers | null;
        projects: { user_id: string };
      }>();
    if (pageError || !page) {
      return NextResponse.json({ error: 'Audio page not found' }, { status: 404 });
    }
    if (page.projects.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!page.draft_vocal_url) {
      return NextResponse.json({ error: 'No draft to shrink — Save draft first' }, { status: 400 });
    }

    // 1. Download current draft.
    const res = await fetch(page.draft_vocal_url);
    if (!res.ok) {
      return NextResponse.json({ error: `Could not fetch draft: HTTP ${res.status}` }, { status: 500 });
    }
    const sourceBuf = Buffer.from(await res.arrayBuffer());

    // 2. FFmpeg per-segment atrim + concat → new MP3 buffer. Detect the
    //    source codec from the URL path so the temp file gets the right
    //    extension; MediaRecorder draft uploads are typically .webm and
    //    FFmpeg refuses to decode them as MP3.
    const srcExt = detectExtFromUrl(page.draft_vocal_url);
    const newBuf = await renderSegmentsToMp3(sourceBuf, keepSegments, srcExt);

    // 3. Upload to a new draft path. Don't overwrite the old one — Supabase
    //    Storage's `upsert: false` would error, and a versioned filename
    //    lets us roll back via the audit trail if anything goes wrong.
    const path = `${page.project_id}/drafts/page-${page.page_number}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, newBuf, { contentType: 'audio/mpeg', upsert: false });
    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }
    const { data: { publicUrl } } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    // 4. Update draft_layers: collapse vocal.segments to a single full
    //    segment of the new shorter source. Effects are preserved as-is
    //    (their placements are in mix-time, which doesn't change).
    const newDurationSec = keepSegments.reduce(
      (sum, s) => sum + Math.max(0, s.endSec - s.startSec),
      0,
    );
    const collapsedSegments: VocalSegment[] = [{ startSec: 0, endSec: newDurationSec }];
    const newLayers: AudioLayers = page.draft_layers
      ? {
          ...page.draft_layers,
          vocal: {
            ...page.draft_layers.vocal,
            url: publicUrl,
            durationSec: newDurationSec,
            segments: collapsedSegments,
            trimStartSec: undefined,
            trimEndSec: undefined,
          },
        }
      : {
          version: 1,
          vocal: {
            url: publicUrl,
            durationSec: newDurationSec,
            segments: collapsedSegments,
          },
          music: [],
          effects: [],
        };

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('story_audio_pages')
      .update({
        draft_vocal_url: publicUrl,
        draft_layers: newLayers,
        draft_updated_at: now,
      })
      .eq('id', audioPageId);
    if (updateError) {
      return NextResponse.json({ error: `Update failed: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      draft_vocal_url: publicUrl,
      durationSec: newDurationSec,
      segments: collapsedSegments,
      draft_updated_at: now,
    });
  } catch (error: any) {
    console.error('POST /api/v1/audio-pages/[id]/shrink-source error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to shrink source' },
      { status: 500 }
    );
  }
}

/** Pull the file extension out of a Supabase Storage URL path, falling
 *  back to "mp3" if the path has no extension. Used to write the
 *  downloaded blob to a temp file FFmpeg can decode (WebM-as-mp3 fails). */
function detectExtFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const m = path.match(/\.([a-z0-9]+)(?:\?|$)/i);
    if (!m) return 'mp3';
    const ext = m[1].toLowerCase();
    // Whitelist known formats — anything else, fall back to webm since
    // that's what MediaRecorder produces.
    if (['mp3', 'webm', 'm4a', 'mp4', 'wav', 'ogg'].includes(ext)) return ext;
    return 'webm';
  } catch {
    return 'mp3';
  }
}

/** Render keep-segments back-to-back from a source audio buffer. Output
 *  is always MP3 (libmp3lame) — input can be any format FFmpeg accepts.
 *  Uses the same per-segment atrim + concat pipeline as mix.service so
 *  audio output is identical between "render to draft_vocal_url" and
 *  "render to audio_url." */
async function renderSegmentsToMp3(sourceBuf: Buffer, segments: VocalSegment[], inExt: string): Promise<Buffer> {
  const tempId = `shrink-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inPath = join(tmpdir(), `${tempId}-in.${inExt}`);
  const outPath = join(tmpdir(), `${tempId}-out.mp3`);
  try {
    await writeFile(inPath, sourceBuf);
    const filterChains: string[] = [];
    const segLabels: string[] = [];
    segments.forEach((s, i) => {
      const label = `s${i}`;
      segLabels.push(label);
      filterChains.push(`[0:a]atrim=start=${s.startSec}:end=${s.endSec},asetpts=PTS-STARTPTS[${label}]`);
    });
    const concatInputs = segLabels.map((l) => `[${l}]`).join('');
    filterChains.push(`${concatInputs}concat=n=${segments.length}:v=0:a=1[out]`);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inPath)
        .complexFilter(filterChains, ['out'])
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .format('mp3')
        .on('end', () => resolve())
        .on('error', reject)
        .save(outPath);
    });
    return await readFile(outPath);
  } finally {
    try { await unlink(inPath); } catch { /* ignore */ }
    try { await unlink(outPath); } catch { /* ignore */ }
  }
}
