/**
 * API Route: POST /api/v1/chapter-books/[id]/pdf
 *
 * Renders a chapter book to PDF via headless Chromium. Replaces the
 * react-pdf renderer that couldn't do CSS float / true page breaks.
 *
 * Flow:
 *   1. Auth + access gate (owner OR public/unlisted-with-token).
 *   2. Build the print HTML server-side via docToPages.
 *   3. Launch Chromium, setContent the HTML, wait for fonts + images.
 *   4. page.pdf({ format, margins, footer with page numbers }).
 *   5. Stream back as application/pdf.
 *
 * Debug mode: GET ?debug=html returns the print HTML directly so we
 * can open it in a browser and iterate on the print stylesheet without
 * spinning up Chromium each time.
 *
 * Principle 1 (Security): owner OR public visibility checked before
 *   any expensive operation; private/draft books require an authed
 *   owner session.
 * Principle 7 (Stateless): no in-memory caches; each invocation is
 *   independent. Future warm-pool reuse is a separate optimization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';
import {
  buildChapterBookPrintHtml,
  type ChapterBookPdfFormat,
} from '@/lib/pdf/chapterBookPrintHtml';
import { launchPrintBrowser } from '@/lib/pdf/chromium';

// Chromium needs real time to boot + render. Vercel Pro default is 60s
// which is more than enough for a 10-page kid book; we'll bump only if
// production data shows we need it.
export const maxDuration = 60;
// nodejs runtime required for puppeteer + @sparticuz/chromium. Edge
// runtime can't run a Chromium child process.
export const runtime = 'nodejs';

// Hard cap aligned with the editor's intended scope. Kids writing 15+
// pages should be told to split into volumes; rendering a huge doc
// risks timeout + memory.
const MAX_PAGES_FOR_PDF = 15;

const RequestSchema = z.object({
  format: z.enum(['a5', 'a4', 'large', 'letter']).default('letter'),
});

type ProjectRow = {
  id: string;
  user_id: string | null;
  project_type: string | null;
  title: string | null;
  author_name: string | null;
  canvas_state: Record<string, unknown> | null;
  visibility: string | null;
  share_token: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handle(request, params, 'pdf');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const debug = request.nextUrl.searchParams.get('debug');
  if (debug === 'html') {
    return handle(request, params, 'html');
  }
  return NextResponse.json(
    { error: 'GET only supports ?debug=html; use POST for PDF.' },
    { status: 405 }
  );
}

async function handle(
  request: NextRequest,
  params: Promise<{ id: string }>,
  mode: 'pdf' | 'html'
): Promise<Response> {
  const { id } = await params;

  // Format comes from POST body (PDF) or query string (debug HTML).
  let format: ChapterBookPdfFormat = 'letter';
  if (mode === 'pdf') {
    try {
      const body = await request.json().catch(() => ({}));
      const parsed = RequestSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid request', details: parsed.error.issues },
          { status: 400 }
        );
      }
      format = parsed.data.format;
    } catch {
      // Empty body is fine — use defaults.
    }
  } else {
    const q = request.nextUrl.searchParams.get('format');
    if (q === 'a5' || q === 'a4' || q === 'large' || q === 'letter') format = q;
  }

  // Resolve access. Owner path (authed session) first; if not an
  // owner, fall through to public-visibility check so anyone can
  // export a community-published chapter book.
  const project = await resolveProject(request, id);
  if (!project) {
    return NextResponse.json(
      { error: 'Chapter book not found' },
      { status: 404 }
    );
  }
  if (project.project_type !== 'chapter_book') {
    return NextResponse.json(
      { error: 'Chapter book not found' },
      { status: 404 }
    );
  }

  // Cap page count so kids can't accidentally request a render that
  // blows past Vercel's function timeout.
  const pageCount = countChapterPages(project.canvas_state);
  if (pageCount > MAX_PAGES_FOR_PDF) {
    return NextResponse.json(
      {
        error: `Chapter books over ${MAX_PAGES_FOR_PDF} pages can't export to PDF yet — try splitting into shorter volumes.`,
      },
      { status: 400 }
    );
  }

  const origin = resolveOrigin(request);
  const html = buildChapterBookPrintHtml({
    origin,
    title: project.title,
    authorName: project.author_name,
    canvasState: project.canvas_state,
    format,
  });

  if (mode === 'html') {
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Real PDF path: hand to Chromium.
  let browser: Awaited<ReturnType<typeof launchPrintBrowser>> | null = null;
  try {
    browser = await launchPrintBrowser();
    const page = await browser.newPage();

    // setContent with networkidle0 covers font + image fetches; we
    // still belt-and-suspender with explicit waits below.
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });
    await page.evaluateHandle('document.fonts.ready');
    // Last-ditch: explicitly await every <img>'s decode. This catches
    // edge cases where networkidle0 fires before late <img> elements
    // have actually rasterized.
    await page.evaluate(async () => {
      const imgs = Array.from(document.images);
      await Promise.all(
        imgs.map((img) =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener('load', () => resolve(), { once: true });
                img.addEventListener('error', () => resolve(), { once: true });
              })
        )
      );
    });

    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true, // honors our @page size/margin
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate:
        '<div style="font:9pt \'Helvetica\',sans-serif;color:#9ca3af;width:100%;text-align:center;padding:0 14mm 6mm"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      // Margins here are zero because the print stylesheet already
      // declares @page margin. preferCSSPageSize uses the CSS values.
      margin: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const filename = (project.title ?? 'chapter-book')
      .replace(/[\\/:*?"<>|]/g, '_')
      .slice(0, 80);

    // Puppeteer returns Uint8Array; Response wants BodyInit. Wrapping
    // in a Buffer keeps it a typed Uint8Array view but with the right
    // overload signature.
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[chapter-book pdf] render failed', err);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (err) {
        console.warn('[chapter-book pdf] browser.close() failed', err);
      }
    }
  }
}

/**
 * Resolve the project + permission check. Returns null if either the
 * project doesn't exist or the caller lacks access — caller maps this
 * to 404 to avoid leaking id-space.
 */
async function resolveProject(
  request: NextRequest,
  id: string
): Promise<ProjectRow | null> {
  // Try owner path first using a session-aware client. If the user is
  // authed and owns this book, RLS lets the select through.
  try {
    const ownerSupabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await ownerSupabase.auth.getUser();

    if (user) {
      const { data, error } = await ownerSupabase
        .from('projects')
        .select(
          'id, user_id, project_type, title, author_name, canvas_state, visibility, share_token'
        )
        .eq('id', id)
        .single();
      if (!error && data && data.user_id === user.id) {
        return data as ProjectRow;
      }
    }
  } catch (err) {
    console.warn('[chapter-book pdf] owner path failed', err);
  }

  // Fall back to public visibility check via service role so anonymous
  // readers can export a community-published book. Token works for
  // unlisted.
  const tokenParam = request.nextUrl.searchParams.get('token');
  try {
    const service = createServiceRoleClient();
    const { data, error } = await service
      .from('projects')
      .select(
        'id, user_id, project_type, title, author_name, canvas_state, visibility, share_token'
      )
      .eq('id', id)
      .single();
    if (error || !data) return null;
    const row = data as ProjectRow;
    const isPublic = row.visibility === 'public';
    const isUnlistedWithToken =
      row.visibility === 'unlisted' &&
      !!row.share_token &&
      !!tokenParam &&
      tokenParam === row.share_token;
    if (isPublic || isUnlistedWithToken) return row;
  } catch (err) {
    console.warn('[chapter-book pdf] public path failed', err);
  }

  return null;
}

function countChapterPages(canvas: Record<string, unknown> | null): number {
  if (!canvas || !Array.isArray((canvas as { content?: unknown[] }).content)) {
    return 1;
  }
  const content = (canvas as { content: Array<{ type?: string }> }).content;
  let pages = 1;
  for (const node of content) {
    if (node?.type === 'pageBreak') pages += 1;
  }
  return pages;
}

function resolveOrigin(request: NextRequest): string {
  // Prefer the public site URL env so the print HTML pulls fonts from
  // the canonical origin in prod (Vercel preview deploys can have
  // weird hostnames). Falls back to the request's origin in local dev.
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  }
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}
