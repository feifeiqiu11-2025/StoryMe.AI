#!/usr/bin/env npx ts-node
/**
 * Quick Gemini Test - Single image generation to verify API works
 * Run: npx ts-node src/lib/image-providers/poc-gemini/quick-test.ts
 */

import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables manually
function loadEnvFile(filePath: string) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          process.env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
  } catch (e) {
    // File doesn't exist, that's okay
  }
}

loadEnvFile(path.join(__dirname, '../../../../.env.local'));

async function quickTest() {
  console.log('🚀 Quick Gemini API Test\n');

  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found!');
    console.error('\nTo fix this:');
    console.error('1. Go to https://aistudio.google.com/apikey');
    console.error('2. Create a new API key');
    console.error('3. Add to .env.local: GEMINI_API_KEY=your_key_here');
    process.exit(1);
  }

  console.log('✅ GEMINI_API_KEY found\n');

  // Import client
  const { GeminiImageClient } = await import('./gemini-client');

  // Character image path
  const characterImagePath = path.join(
    __dirname,
    '../../../../public/uploads/character-char-1760498820412-1760498825572-IMG_7321.jpg'
  );

  // Verify image exists
  if (!fs.existsSync(characterImagePath)) {
    console.error(`❌ Character image not found: ${characterImagePath}`);
    process.exit(1);
  }
  console.log(`✅ Character image found: ${path.basename(characterImagePath)}\n`);

  // Output directory
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    console.log('🎨 Generating test image...');
    console.log('   Scene: Child playing at sunny park');
    console.log('   This may take 10-30 seconds...\n');

    const client = new GeminiImageClient();
    const startTime = Date.now();

    const result = await client.generateWithCharacters({
      characters: [
        {
          name: 'TestChild',
          referenceImagePath: characterImagePath,
          description: {
            age: '5',
            clothing: 'casual clothes',
          },
        },
      ],
      sceneDescription: 'A happy child playing on a swing at a sunny park with green grass and blue sky',
      artStyle: "children's book illustration, colorful, whimsical, Pixar style",
    });

    const outputPath = path.join(outputDir, 'quick-test-result.png');
    client.saveImage(result, outputPath);

    const duration = Date.now() - startTime;

    console.log('✅ SUCCESS!\n');
    console.log(`   Generation time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
    console.log(`   Model used: ${result.modelUsed}`);
    console.log(`   Output saved: ${outputPath}`);
    console.log('\n📸 Open the image to verify quality!');
    console.log('\nNext steps:');
    console.log('   - If image looks good, run the full test:');
    console.log('     npx ts-node src/lib/image-providers/poc-gemini/test-gemini.ts');

    // Try to open the image (macOS)
    console.log('\n🖼️  Attempting to open image...');
    exec(`open "${outputPath}"`, (err: Error | null) => {
      if (err) {
        console.log('   Could not auto-open. Please open manually.');
      }
    });

  } catch (error) {
    console.error('❌ Generation failed!\n');
    console.error('Error:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('API_KEY')) {
      console.error('\n💡 This looks like an API key issue.');
      console.error('   Make sure your GEMINI_API_KEY is valid.');
    }

    if (error instanceof Error && error.message.includes('quota')) {
      console.error('\n💡 This looks like a quota/rate limit issue.');
      console.error('   You may need to enable billing or wait.');
    }

    if (error instanceof Error && error.message.includes('image')) {
      console.error('\n💡 This might be a content policy issue.');
      console.error('   Try with a different prompt or image.');
    }

    process.exit(1);
  }
}

quickTest();
