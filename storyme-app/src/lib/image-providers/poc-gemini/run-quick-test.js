#!/usr/bin/env node
/**
 * Quick Gemini Test Runner - CommonJS wrapper
 * This avoids ES module issues with ts-node
 *
 * Run: node src/lib/image-providers/poc-gemini/run-quick-test.js
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Load environment variables manually
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key.trim()] = value;
        }
      }
    });
  } catch (e) {
    // File doesn't exist, that's okay
  }
}

const envPath = path.join(__dirname, '../../../../.env.local');
loadEnvFile(envPath);

async function main() {
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

  // Character image path
  const characterImagePath = path.join(
    __dirname,
    '../../../../public/uploads/character-char-1760498820412-1760498825572-IMG_7321.jpg'
  );

  // Verify image exists
  if (!fs.existsSync(characterImagePath)) {
    console.error(`❌ Character image not found: ${characterImagePath}`);
    console.error('\nLooking for alternative character images...');

    const uploadsDir = path.join(__dirname, '../../../../public/uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir).filter(f =>
        f.startsWith('character-') && (f.endsWith('.jpg') || f.endsWith('.png'))
      );
      if (files.length > 0) {
        console.log(`Found ${files.length} character images:`);
        files.forEach(f => console.log(`  - ${f}`));
      } else {
        console.log('No character images found in uploads folder.');
      }
    }
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

    // Import Gemini SDK
    const { GoogleGenerativeAI } = require('@google/generative-ai');

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    // Models that support image generation:
    // - gemini-2.5-flash-image (newer image generation model)
    // - gemini-2.0-flash-exp-image-generation (dedicated image generation model)
    // - gemini-2.0-flash-exp (experimental, general purpose with image gen)
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-image';
    console.log(`   Using model: ${modelName}`);

    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    // Load character reference image
    const imageBuffer = fs.readFileSync(characterImagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const ext = path.extname(characterImagePath).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

    // Build prompt
    const prompt = `Generate a children's book illustration, colorful, whimsical, Pixar style image showing:
A happy child playing on a swing at a sunny park with green grass and blue sky.

CHARACTER (maintain exact appearance from reference photo):
- TestChild: 5 years old, wearing casual clothes

IMPORTANT RULES:
1. The child must match the reference photo exactly (face, skin tone, hair)
2. Maintain casual clothing style
3. The child is HUMAN - do not merge with animals or objects
4. Style: Professional children's book illustration
5. Aspect ratio: 1:1

Scene: A happy child playing on a swing at a sunny park with green grass and blue sky`;

    const startTime = Date.now();

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: mimeType,
          data: imageBase64,
        },
      },
      '[Reference photo for TestChild]'
    ]);

    const response = result.response;
    const candidates = response.candidates;

    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates in response');
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new Error('No parts in response');
    }

    // Find the image part
    const imagePart = parts.find(p => p.inlineData);
    if (!imagePart || !imagePart.inlineData) {
      // Check for text response
      const textPart = parts.find(p => p.text);
      const errorMsg = textPart?.text || 'No image generated';
      throw new Error(`Image generation failed: ${errorMsg}`);
    }

    const duration = Date.now() - startTime;
    const outputPath = path.join(outputDir, 'quick-test-result.png');

    // Save the image
    const outputBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    fs.writeFileSync(outputPath, outputBuffer);

    console.log('✅ SUCCESS!\n');
    console.log(`   Generation time: ${duration}ms (${(duration / 1000).toFixed(1)}s)`);
    console.log(`   Model used: gemini-2.0-flash-exp`);
    console.log(`   Output saved: ${outputPath}`);
    console.log('\n📸 Open the image to verify quality!');
    console.log('\nNext steps:');
    console.log('   - If image looks good, run the full test:');
    console.log('     node src/lib/image-providers/poc-gemini/run-full-test.js');

    // Try to open the image (macOS)
    console.log('\n🖼️  Attempting to open image...');
    exec(`open "${outputPath}"`, (err) => {
      if (err) {
        console.log('   Could not auto-open. Please open manually.');
      }
    });

  } catch (error) {
    console.error('❌ Generation failed!\n');
    console.error('Error:', error.message || error);

    if (error.message && error.message.includes('API_KEY')) {
      console.error('\n💡 This looks like an API key issue.');
      console.error('   Make sure your GEMINI_API_KEY is valid.');
    }

    if (error.message && error.message.includes('quota')) {
      console.error('\n💡 This looks like a quota/rate limit issue.');
      console.error('   You may need to enable billing or wait.');
    }

    if (error.message && error.message.includes('image')) {
      console.error('\n💡 This might be a content policy issue.');
      console.error('   Try with a different prompt or image.');
    }

    process.exit(1);
  }
}

main();
