/**
 * Keep-warm endpoint.
 *
 * Hit by the Vercel cron in vercel.json every ~5 minutes during peak
 * hours to keep one Node.js serverless instance warm. Without this,
 * kids opening the app after a quiet period (early morning, after a
 * long pause) pay a 1-3 second cold-start penalty on the first story
 * tap.
 *
 * Why this URL and not /api/stories/public/* directly:
 *   - The story endpoints set Cache-Control headers, so the CDN would
 *     serve cached responses and the function would never run — the
 *     cron would warm the CDN, not the Node process.
 *   - This route returns no-cache so every cron hit reaches the function.
 *
 * Node serverless functions on Vercel share a process per region.
 * Warming any route warms all routes that share its build target.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    { ok: true, ts: Date.now() },
    {
      headers: {
        // Critical: never cache so cron always reaches the function.
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
