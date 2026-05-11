/**
 * Headless Chromium launcher used by the chapter-book PDF endpoint.
 *
 * Two environments to support:
 *   - Vercel serverless function: use @sparticuz/chromium (a Lambda-
 *     compatible Chromium build) + puppeteer-core. The standard
 *     `puppeteer` package ships its own Chromium for desktop dev,
 *     which is too big for a serverless function bundle.
 *   - Local dev: there's no @sparticuz/chromium binary to fall back
 *     to (it only unpacks on Linux/Lambda), so we point puppeteer-core
 *     at the system Chrome via executablePath. Devs on macOS get the
 *     default; everyone else sets PUPPETEER_EXECUTABLE_PATH.
 *
 * Fresh browser per request — no singleton. The PDF endpoint awaits
 * launch + setContent + page.pdf + close, then returns. With Vercel's
 * per-invocation isolation this is the simplest correct design;
 * warm-instance reuse is a future optimization if cold starts hurt.
 */

import puppeteer, { type Browser } from 'puppeteer-core';

const DEFAULT_MAC_CHROME =
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export async function launchPrintBrowser(): Promise<Browser> {
  if (process.env.VERCEL_ENV) {
    // Dynamic import so the heavy @sparticuz/chromium package isn't
    // bundled into local dev (where it can't actually run anyway —
    // its Chromium binary targets Lambda/Linux).
    const chromium = (await import('@sparticuz/chromium')).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? DEFAULT_MAC_CHROME;

  return puppeteer.launch({
    executablePath,
    headless: true,
    // A reasonable default viewport; print output ignores viewport but
    // some CSS (e.g. media queries on width) keys off it during layout.
    defaultViewport: { width: 1024, height: 768 },
  });
}
