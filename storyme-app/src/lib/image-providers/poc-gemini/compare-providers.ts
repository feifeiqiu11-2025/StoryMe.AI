#!/usr/bin/env npx ts-node
/**
 * Provider Comparison Test
 *
 * Generates the same scene with different providers to compare:
 * 1. Current FLUX LoRA (text-only)
 * 2. Gemini 3 Pro Image (with reference images)
 *
 * This helps evaluate if Gemini is worth the migration.
 */

import * as path from 'path';
import * as fs from 'fs';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../../.env.local') });

const OUTPUT_DIR = path.join(__dirname, 'comparison-output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Test character (same for both providers)
const CHARACTER = {
  name: 'Connor',
  description: {
    age: '5',
    skinTone: 'light',
    hairColor: 'brown',
    clothing: 'red t-shirt and blue jeans',
    otherFeatures: 'bright smile',
  },
  // For Gemini - update this to an actual photo URL
  referenceImageUrl: 'https://via.placeholder.com/512x512.png?text=Connor',
};

// Test scenes
const TEST_SCENES = [
  'playing at sunny park on the swings',
  'eating breakfast at kitchen table',
  'standing next to a friendly golden retriever dog',
];

interface ComparisonResult {
  scene: string;
  flux: {
    success: boolean;
    timeMs: number;
    outputFile?: string;
    error?: string;
  };
  gemini: {
    success: boolean;
    timeMs: number;
    outputFile?: string;
    error?: string;
  };
}

async function testFluxProvider(scene: string, index: number): Promise<ComparisonResult['flux']> {
  console.log(`  [FLUX] Generating...`);

  try {
    // Dynamic import to handle the fal client
    const { generateImageWithMultipleCharacters } = await import('../../fal-client');

    const startTime = Date.now();
    const result = await generateImageWithMultipleCharacters({
      characters: [{
        name: CHARACTER.name,
        referenceImageUrl: CHARACTER.referenceImageUrl,
        description: CHARACTER.description,
      }],
      sceneDescription: `${CHARACTER.name} ${scene}`,
      artStyle: "children's book illustration, colorful, whimsical",
    });

    const timeMs = Date.now() - startTime;
    const outputFile = path.join(OUTPUT_DIR, `scene-${index + 1}-flux.png`);

    // Download and save the image
    const response = await fetch(result.imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputFile, buffer);

    console.log(`  [FLUX] ✅ Done in ${timeMs}ms`);
    return { success: true, timeMs, outputFile };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  [FLUX] ❌ Error: ${errorMsg}`);
    return { success: false, timeMs: 0, error: errorMsg };
  }
}

async function testGeminiProvider(scene: string, index: number): Promise<ComparisonResult['gemini']> {
  console.log(`  [Gemini] Generating...`);

  try {
    const { GeminiImageClient } = await import('./gemini-client');
    const client = new GeminiImageClient();

    const startTime = Date.now();
    const result = await client.generateWithCharacters({
      characters: [{
        name: CHARACTER.name,
        referenceImageUrl: CHARACTER.referenceImageUrl,
        description: CHARACTER.description,
      }],
      sceneDescription: `${CHARACTER.name} ${scene}`,
      artStyle: "children's book illustration, colorful, whimsical",
    });

    const timeMs = Date.now() - startTime;
    const outputFile = path.join(OUTPUT_DIR, `scene-${index + 1}-gemini.png`);
    client.saveImage(result, outputFile);

    console.log(`  [Gemini] ✅ Done in ${timeMs}ms`);
    return { success: true, timeMs, outputFile };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`  [Gemini] ❌ Error: ${errorMsg}`);
    return { success: false, timeMs: 0, error: errorMsg };
  }
}

async function main() {
  console.log('🔬 Provider Comparison Test');
  console.log(`📁 Output: ${OUTPUT_DIR}`);
  console.log('');

  // Check API keys
  if (!process.env.FAL_KEY) {
    console.warn('⚠️  FAL_KEY not found - FLUX tests will fail');
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY not found - Gemini tests will fail');
  }

  const results: ComparisonResult[] = [];

  for (let i = 0; i < TEST_SCENES.length; i++) {
    const scene = TEST_SCENES[i];
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Scene ${i + 1}: ${CHARACTER.name} ${scene}`);
    console.log('='.repeat(50));

    const fluxResult = await testFluxProvider(scene, i);
    await new Promise(r => setTimeout(r, 1000)); // Rate limit buffer

    const geminiResult = await testGeminiProvider(scene, i);
    await new Promise(r => setTimeout(r, 2000)); // Rate limit buffer

    results.push({
      scene,
      flux: fluxResult,
      gemini: geminiResult,
    });
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`);
  console.log('📊 COMPARISON SUMMARY');
  console.log('='.repeat(50));

  console.log('\n| Scene | FLUX | Gemini |');
  console.log('|-------|------|--------|');

  for (const result of results) {
    const fluxStatus = result.flux.success ? `✅ ${result.flux.timeMs}ms` : '❌';
    const geminiStatus = result.gemini.success ? `✅ ${result.gemini.timeMs}ms` : '❌';
    console.log(`| ${result.scene.substring(0, 30)}... | ${fluxStatus} | ${geminiStatus} |`);
  }

  // Averages
  const fluxSuccesses = results.filter(r => r.flux.success);
  const geminiSuccesses = results.filter(r => r.gemini.success);

  if (fluxSuccesses.length > 0) {
    const avgFlux = fluxSuccesses.reduce((sum, r) => sum + r.flux.timeMs, 0) / fluxSuccesses.length;
    console.log(`\nFLUX average time: ${avgFlux.toFixed(0)}ms (${fluxSuccesses.length}/${results.length} successful)`);
  }

  if (geminiSuccesses.length > 0) {
    const avgGemini = geminiSuccesses.reduce((sum, r) => sum + r.gemini.timeMs, 0) / geminiSuccesses.length;
    console.log(`Gemini average time: ${avgGemini.toFixed(0)}ms (${geminiSuccesses.length}/${results.length} successful)`);
  }

  // Cost comparison (estimated)
  console.log('\n💰 COST COMPARISON (estimated)');
  console.log(`FLUX: ~$0.03/image × ${results.length} = $${(0.03 * results.length).toFixed(2)}`);
  console.log(`Gemini: ~$0.039/image × ${results.length} = $${(0.039 * results.length).toFixed(2)}`);

  // Save results
  const resultsFile = path.join(OUTPUT_DIR, 'comparison-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    character: CHARACTER,
    results,
  }, null, 2));

  console.log(`\n📄 Results saved to: ${resultsFile}`);
  console.log(`\n📸 Compare images side-by-side in: ${OUTPUT_DIR}`);

  console.log(`
${'='.repeat(50)}
📋 EVALUATION GUIDE
${'='.repeat(50)}

Open the output folder and compare images:
- scene-1-flux.png vs scene-1-gemini.png
- scene-2-flux.png vs scene-2-gemini.png
- scene-3-flux.png vs scene-3-gemini.png

Evaluate:
1. Does Connor look the SAME across FLUX images? (probably not)
2. Does Connor look the SAME across Gemini images? (should be better)
3. In dog scene - is Connor clearly human in both?
4. Which has better art style consistency?

DECISION GUIDE:
- If Gemini is noticeably better → Migrate to Gemini
- If similar quality → Stay with FLUX (cheaper)
- If Gemini has issues → Try Ideogram Character
`);
}

main().catch(console.error);
