/**
 * POST /api/v1/sfx-library/freesound/import
 *
 * Body: { freesoundId: number }
 *
 * Downloads the HQ MP3 preview, uploads it to the `sfx-library` storage
 * bucket, and upserts a sfx_library row with source='freesound'. Idempotent —
 * if the same Freesound ID was imported before (by this user or anyone),
 * the existing row is returned.
 *
 * Why a write endpoint exists in addition to the search proxy: the search
 * proxy returns preview URLs hosted by Freesound. We don't want the app to
 * play directly from Freesound's CDN in case it changes or rate-limits us,
 * so each picked sound is copied to our own storage on first use.
 *
 * Uses the service role to bypass RLS for sfx_library + storage writes.
 * Auth check still runs (caller must be a logged-in user) so anonymous
 * traffic can't add rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClientFromRequest } from '@/lib/supabase/server';
import { importFreesoundSound } from '@/lib/sfx/import-from-freesound';

export const maxDuration = 30;

const BodySchema = z.object({
  freesoundId: z.number().int().positive(),
  /** sfx (default) or music — stored on the new sfx_library row so the
   *  recorder browser shows the import under the right top tab. */
  kind: z.enum(['sfx', 'music']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Auth check uses the user's session — anonymous can't trigger imports.
    const userClient = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid body', details: parsed.error.issues },
        { status: 400 }
      );
    }

    // The actual write needs service role because sfx_library RLS denies
    // anon/auth writes by design (we don't want users injecting non-CC0
    // sounds). The import helper validates source via the Freesound API
    // response license field upstream.
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json(
        { error: 'Server not configured for library writes' },
        { status: 500 }
      );
    }
    const serviceClient = createSupabaseClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let imported;
    try {
      imported = await importFreesoundSound(serviceClient, parsed.data.freesoundId, {
        kind: parsed.data.kind,
      });
    } catch (err: any) {
      console.error('Freesound import failed:', err);
      return NextResponse.json(
        { error: err.message || 'Import failed' },
        { status: 502 }
      );
    }

    return NextResponse.json({ sound: imported });
  } catch (error: any) {
    console.error('POST /api/v1/sfx-library/freesound/import error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import' },
      { status: 500 }
    );
  }
}
