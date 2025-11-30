#!/usr/bin/env npx ts-node
/**
 * Gemini Image Generation POC Test Script
 *
 * Tests character consistency across multiple scenarios.
 * Run: npx ts-node src/lib/image-providers/poc-gemini/test-gemini.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { GeminiImageClient, CharacterReference, GeminiGenerateResult } from './gemini-client';

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../../../../.env.local') });

// Test output directory
const OUTPUT_DIR = path.join(__dirname, 'test-output');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Test characters - Using actual uploaded character photos from your project
const TEST_CHARACTERS: CharacterReference[] = [
  {
    name: 'Connor',
    // Using actual character photo from uploads folder
    referenceImagePath: path.join(__dirname, '../../../../public/uploads/character-char-1760498820412-1760498825572-IMG_7321.jpg'),
    description: {
      age: '5',
      skinTone: 'light',
      hairColor: 'brown',
      clothing: 'red t-shirt and blue jeans',
      otherFeatures: 'bright smile, friendly eyes',
    },
  },
  {
    name: 'Carter',
    // Using another character photo
    referenceImagePath: path.join(__dirname, '../../../../public/uploads/character-char-1760498808726-1760498816605-IMG_6543.jpg'),
    description: {
      age: '6',
      skinTone: 'medium brown',
      hairColor: 'black curly',
      clothing: 'green hoodie and black pants',
      otherFeatures: 'curious expression',
    },
  },
];

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'single-character-park',
    description: 'Connor playing on a swing at a sunny park',
    characters: [TEST_CHARACTERS[0]],
  },
  {
    name: 'single-character-kitchen',
    description: 'Connor helping to bake cookies in a bright kitchen',
    characters: [TEST_CHARACTERS[0]],
  },
  {
    name: 'two-characters-playground',
    description: 'Connor and Carter playing together on a playground slide',
    characters: TEST_CHARACTERS,
  },
  {
    name: 'two-characters-with-animal',
    description: 'Connor and Carter visiting the zoo, standing next to a lion enclosure, looking at a lion',
    characters: TEST_CHARACTERS,
  },
  {
    name: 'character-with-dog',
    description: 'Connor petting a friendly golden retriever dog in the backyard',
    characters: [TEST_CHARACTERS[0]],
  },
];

// Test results tracking
interface TestResult {
  scenario: string;
  success: boolean;
  generationTimeMs: number;
  outputFile?: string;
  error?: string;
  notes?: string;
}

async function runTest(
  client: GeminiImageClient,
  scenario: typeof TEST_SCENARIOS[0]
): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Characters: ${scenario.characters.map(c => c.name).join(', ')}`);
  console.log('='.repeat(60));

  try {
    const result = await client.generateWithCharacters({
      characters: scenario.characters,
      sceneDescription: scenario.description,
      artStyle: "children's book illustration, colorful, whimsical, Pixar style",
    });

    const outputFile = path.join(OUTPUT_DIR, `${scenario.name}.png`);
    client.saveImage(result, outputFile);

    console.log(`✅ Success! Generated in ${result.generationTimeMs}ms`);
    console.log(`   Output: ${outputFile}`);

    return {
      scenario: scenario.name,
      success: true,
      generationTimeMs: result.generationTimeMs,
      outputFile,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ Failed: ${errorMsg}`);

    return {
      scenario: scenario.name,
      success: false,
      generationTimeMs: 0,
      error: errorMsg,
    };
  }
}

async function runStoryTest(client: GeminiImageClient): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log('Testing: Full Story (5 scenes with same characters)');
  console.log('='.repeat(60));

  const storyScenes = [
    'Connor and Carter wake up excited for their adventure',
    'Connor and Carter eat breakfast together at the kitchen table',
    'Connor and Carter walk to the zoo entrance',
    'Connor and Carter look at elephants at the zoo',
    'Connor and Carter wave goodbye as they leave the zoo',
  ];

  const storyOutputDir = path.join(OUTPUT_DIR, 'story');
  if (!fs.existsSync(storyOutputDir)) {
    fs.mkdirSync(storyOutputDir, { recursive: true });
  }

  try {
    const startTime = Date.now();
    const results = await client.generateStoryScenes(
      TEST_CHARACTERS,
      storyScenes,
      "children's book illustration, colorful, whimsical",
      storyOutputDir
    );

    const totalTime = Date.now() - startTime;
    const avgTime = totalTime / results.length;

    console.log(`✅ Story generation complete!`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Average per scene: ${avgTime.toFixed(0)}ms`);
    console.log(`   Output directory: ${storyOutputDir}`);

    return {
      scenario: 'full-story-5-scenes',
      success: true,
      generationTimeMs: totalTime,
      outputFile: storyOutputDir,
      notes: `5 scenes, avg ${avgTime.toFixed(0)}ms each`,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.log(`❌ Story generation failed: ${errorMsg}`);

    return {
      scenario: 'full-story-5-scenes',
      success: false,
      generationTimeMs: 0,
      error: errorMsg,
    };
  }
}

async function main() {
  console.log('🚀 Gemini Image Generation POC Test');
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log('');

  // Check for API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found in environment');
    console.error('   Add it to .env.local: GEMINI_API_KEY=your_key_here');
    console.error('   Get a key from: https://aistudio.google.com/apikey');
    process.exit(1);
  }

  console.log('✅ GEMINI_API_KEY found');

  // Initialize client
  const client = new GeminiImageClient();

  // Run individual scenario tests
  const results: TestResult[] = [];

  for (const scenario of TEST_SCENARIOS) {
    const result = await runTest(client, scenario);
    results.push(result);

    // Delay between tests to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Run full story test
  const storyResult = await runStoryTest(client);
  results.push(storyResult);

  // Print summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  const totalTime = results.reduce((sum, r) => sum + r.generationTimeMs, 0);

  console.log(`\nResults: ${successCount} passed, ${failCount} failed`);
  console.log(`Total generation time: ${totalTime}ms`);
  console.log(`Average time per test: ${(totalTime / results.length).toFixed(0)}ms`);

  console.log('\nDetailed Results:');
  console.log('-'.repeat(60));

  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.scenario}`);
    if (result.success) {
      console.log(`   Time: ${result.generationTimeMs}ms`);
      if (result.notes) console.log(`   Notes: ${result.notes}`);
    } else {
      console.log(`   Error: ${result.error}`);
    }
  }

  // Save results to JSON
  const resultsFile = path.join(OUTPUT_DIR, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { successCount, failCount, totalTimeMs: totalTime },
    results,
  }, null, 2));
  console.log(`\n📄 Results saved to: ${resultsFile}`);

  // Evaluation checklist
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 MANUAL EVALUATION CHECKLIST');
  console.log('='.repeat(60));
  console.log(`
After reviewing the generated images in ${OUTPUT_DIR}, evaluate:

1. CHARACTER CONSISTENCY
   [ ] Connor's face looks similar across all images
   [ ] Carter's face looks similar across all images
   [ ] Skin tones match character descriptions
   [ ] Hair color/style matches descriptions

2. CLOTHING CONSISTENCY
   [ ] Connor wears red t-shirt and blue jeans consistently
   [ ] Carter wears green hoodie and black pants consistently

3. HUMAN-ANIMAL SEPARATION
   [ ] In zoo scene: Connor and Carter are clearly human
   [ ] In dog scene: Connor is clearly human, dog is clearly dog
   [ ] No hybrid/merged creatures

4. ART STYLE
   [ ] Consistent children's book illustration style
   [ ] Colors are vibrant and appealing
   [ ] Appropriate for children's storybook

5. STORY FLOW
   [ ] 5 story scenes feel cohesive
   [ ] Characters are recognizable throughout

DECISION:
[ ] PASS - Ready to integrate Gemini as primary provider
[ ] PARTIAL - Use Gemini for multi-character scenes only
[ ] FAIL - Try Ideogram Character instead
[ ] FAIL - Stay with improved FLUX LoRA
`);

  process.exit(failCount > 0 ? 1 : 0);
}

// Run if executed directly
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
