/**
 * Minimal Freesound API client.
 *
 * Why we don't use a published SDK: the official freesound-python lib doesn't
 * have a maintained TypeScript port, and our needs are tiny (search + sound
 * detail). Hand-rolled fetch is cheaper than chasing a dependency.
 *
 * Auth: token-based. Get a key at https://freesound.org/apiv2/apply/.
 *   - For search + metadata: pass `token` query param (no OAuth needed).
 *   - For ORIGINAL file download: requires OAuth2 user flow — we don't do
 *     this. Instead we use the publicly-accessible HQ MP3 preview URL,
 *     which is the same audio at ~192kbps. Plenty for SFX layering.
 *
 * Reference: https://freesound.org/docs/api/resources_apiv2.html
 */

const BASE_URL = 'https://freesound.org/apiv2';

export interface FreesoundSearchResult {
  id: number;
  name: string;
  tags: string[];
  duration: number;       // seconds (float)
  license: string;        // full license URL
  username: string;
  /** Object of preview URLs. `preview-hq-mp3` is what we download. */
  previews: {
    'preview-hq-mp3': string;
    'preview-lq-mp3': string;
    'preview-hq-ogg'?: string;
    'preview-lq-ogg'?: string;
  };
}

interface FreesoundSearchResponse {
  count: number;
  next: string | null;
  results: FreesoundSearchResult[];
}

function getApiKey(): string {
  const key = process.env.FREESOUND_API_KEY;
  if (!key) {
    throw new Error('FREESOUND_API_KEY not set. Get one at https://freesound.org/apiv2/apply/');
  }
  return key;
}

/** Search Freesound, filtered to CC0 only. The license filter string must
    match Freesound's stored value exactly — they use the long human label,
    not the SPDX identifier. */
export async function searchCC0(opts: {
  query: string;
  pageSize?: number;
  /** 1-based page number for pagination. Default 1. */
  page?: number;
  /** Sort: 'score' (relevance, default), 'duration_asc', 'rating_desc', etc. */
  sort?: 'score' | 'duration_asc' | 'rating_desc' | 'downloads_desc';
  /** Min duration in seconds — useful for filtering music vs SFX. */
  minDurationSec?: number;
  /** Max duration in seconds — caps results for both lanes. */
  maxDurationSec?: number;
}): Promise<FreesoundSearchResult[]> {
  // Freesound supports range queries via the filter field. Combine the
  // license filter with optional duration bounds. Bounds are exclusive
  // brackets but Freesound treats both ends inclusively in practice.
  const filterParts = ['license:"Creative Commons 0"'];
  if (typeof opts.minDurationSec === 'number' || typeof opts.maxDurationSec === 'number') {
    const lo = typeof opts.minDurationSec === 'number' ? opts.minDurationSec : '*';
    const hi = typeof opts.maxDurationSec === 'number' ? opts.maxDurationSec : '*';
    filterParts.push(`duration:[${lo} TO ${hi}]`);
  }
  const params = new URLSearchParams({
    query: opts.query,
    filter: filterParts.join(' '),
    fields: 'id,name,tags,duration,license,username,previews',
    page_size: String(opts.pageSize ?? 10),
    page: String(opts.page ?? 1),
    sort: opts.sort ?? 'score',
    token: getApiKey(),
  });
  const res = await fetch(`${BASE_URL}/search/text/?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Freesound search failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as FreesoundSearchResponse;
  return data.results ?? [];
}

/** Fetch a single sound by ID (used by the import endpoint to look up
    canonical metadata when the client already knows the ID). */
export async function getSound(id: number): Promise<FreesoundSearchResult> {
  const params = new URLSearchParams({
    fields: 'id,name,tags,duration,license,username,previews',
    token: getApiKey(),
  });
  const res = await fetch(`${BASE_URL}/sounds/${id}/?${params.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Freesound sound lookup failed: ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as FreesoundSearchResult;
}

/** Attribution string we store in sfx_library.attribution. Required even
    for CC0 (technically optional under CC0 but courteous). */
export function attributionFor(sound: FreesoundSearchResult): string {
  return `${sound.name} — freesound.org user ${sound.username} (CC0)`;
}
