/**
 * Probe gpt-image-2 access.
 *
 * Run with:  cd storyme-app && npx tsx scripts/probe-gpt-image-2.ts
 *
 * What it does:
 * 1. Calls images.generate with gpt-image-2 (text-only, smallest call).
 * 2. Reports success / failure / model-not-found / rate-limit.
 * 3. Saves the returned PNG to /tmp so you can eyeball quality.
 *
 * Use this BEFORE flipping the admin toggle to OpenAI in the app.
 */

import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set in .env / .env.local');
    process.exit(1);
  }

  const openaiModule = await import('openai');
  const OpenAI = openaiModule.default;
  const openai = new OpenAI({ apiKey });

  const prompt =
    'A friendly cartoon dog in 3D Pixar style, soft textures, large expressive eyes, ' +
    'gentle smile, head-and-shoulders portrait, clean gradient background.';

  console.log('Probing gpt-image-2 with a text-only generate call…');
  console.log(`Prompt: "${prompt}"`);
  const startTime = Date.now();

  try {
    const response = await openai.images.generate({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: 'gpt-image-2' as any,
      prompt,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      size: '1024x1024' as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      quality: 'high' as any,
      n: 1,
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      console.error(`Response in ${elapsed}s but no b64_json data. Full response:`, response);
      process.exit(2);
    }

    const outPath = path.join('/tmp', `probe-gpt-image-2-${Date.now()}.png`);
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    console.log(`SUCCESS in ${elapsed}s. Image saved to: ${outPath}`);
    console.log('Open it to verify visual quality before enabling the admin toggle.');
  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAILED in ${elapsed}s: ${message}`);

    if (message.includes('model') && (message.includes('not found') || message.includes('does not exist') || message.includes('invalid'))) {
      console.error('\nThe gpt-image-2 model is not yet accessible to your API key.');
      console.error('Per OpenAI release notes, public API GA is "early May 2026".');
      console.error('Action: keep the admin toggle hidden / undefault until access is granted.');
    } else if (message.includes('429') || message.includes('rate') || message.includes('quota')) {
      console.error('\nRate limited. Try again in a minute.');
    }
    process.exit(3);
  }
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(99);
});
