#!/usr/bin/env node
/**
 * Full Gemini Test - Multiple scenarios to test character consistency
 * Run: node src/lib/image-providers/poc-gemini/run-full-test.js
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Load environment variables
function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          let value = valueParts.join('=').trim();
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key.trim()] = value;
        }
      }
    });
  } catch (e) {}
}

loadEnvFile(path.join(__dirname, '../../../../.env.local'));

// Test scenarios
const TEST_SCENARIOS = [
  {
    name: 'single-character-park',
    description: 'Connor playing on a swing at a sunny park',
    characterCount: 1,
  },
  {
    name: 'single-character-kitchen',
    description: 'Connor helping to bake cookies in a bright kitchen',
    characterCount: 1,
  },
  {
    name: 'two-characters-playground',
    description: 'Connor and Carter playing together on a playground slide',
    characterCount: 2,
  },
  {
    name: 'character-with-dog',
    description: 'Connor petting a friendly golden retriever dog in the backyard',
    characterCount: 1,
  },
  {
    name: 'two-characters-zoo',
    description: 'Connor and Carter visiting the zoo, standing next to a lion enclosure, looking at a lion. Connor and Carter are HUMAN CHILDREN standing SEPARATELY from the lion.',
    characterCount: 2,
  },
];

async function main() {
  console.log('🚀 Full Gemini POC Test\n');

  // Check API key
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ GEMINI_API_KEY not found!');
    process.exit(1);
  }
  console.log('✅ GEMINI_API_KEY found\n');

  // Character images
  const characterImages = {
    Connor: path.join(__dirname, '../../../../public/uploads/character-char-1760498820412-1760498825572-IMG_7321.jpg'),
    Carter: path.join(__dirname, '../../../../public/uploads/character-char-1760498808726-1760498816605-IMG_6543.jpg'),
  };

  // Verify images exist
  for (const [name, imgPath] of Object.entries(characterImages)) {
    if (!fs.existsSync(imgPath)) {
      console.error(`❌ Character image not found for ${name}: ${imgPath}`);

      // Try to find alternative
      const uploadsDir = path.join(__dirname, '../../../../public/uploads');
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir).filter(f =>
          f.startsWith('character-') && (f.endsWith('.jpg') || f.endsWith('.png'))
        );
        if (files.length > 0) {
          console.log(`Found ${files.length} character images:`);
          files.slice(0, 5).forEach(f => console.log(`  - ${f}`));
        }
      }
      process.exit(1);
    }
    console.log(`✅ ${name}: ${path.basename(imgPath)}`);
  }

  // Output directory
  const outputDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Import Gemini SDK
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-image',
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  // Load character images as base64
  const characterData = {};
  for (const [name, imgPath] of Object.entries(characterImages)) {
    const buffer = fs.readFileSync(imgPath);
    const ext = path.extname(imgPath).toLowerCase();
    characterData[name] = {
      base64: buffer.toString('base64'),
      mimeType: ext === '.png' ? 'image/png' : 'image/jpeg',
    };
  }

  const results = [];
  let totalTime = 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log('Starting tests...');
  console.log('='.repeat(60));

  for (let i = 0; i < TEST_SCENARIOS.length; i++) {
    const scenario = TEST_SCENARIOS[i];
    console.log(`\n[${i + 1}/${TEST_SCENARIOS.length}] ${scenario.name}`);
    console.log(`    ${scenario.description}`);

    try {
      // Build content parts
      const contentParts = [];

      // Build character list
      const characters = scenario.characterCount === 2
        ? ['Connor', 'Carter']
        : ['Connor'];

      // Build prompt
      const charDescriptions = characters.map(name => {
        if (name === 'Connor') {
          return 'Connor: 5 years old, light skin, brown hair, wearing red t-shirt and blue jeans';
        }
        return 'Carter: 6 years old, medium brown skin, black curly hair, wearing green hoodie and black pants';
      }).join('\n- ');

      const prompt = `Generate a children's book illustration, colorful, whimsical, Pixar style image showing:
${scenario.description}

CHARACTERS (maintain exact appearance from reference photos):
- ${charDescriptions}

IMPORTANT RULES:
1. Each character must match their reference photo exactly (face, skin tone, hair)
2. Maintain the specified clothing for each character
3. Characters are HUMAN - do not merge with animals or objects
4. If there are animals in the scene, humans must be SEPARATE from animals
5. Style: Professional children's book illustration`;

      contentParts.push(prompt);

      // Add character reference images
      for (const charName of characters) {
        const data = characterData[charName];
        contentParts.push({
          inlineData: {
            mimeType: data.mimeType,
            data: data.base64,
          },
        });
        contentParts.push(`[Reference photo for ${charName}]`);
      }

      const startTime = Date.now();
      const result = await model.generateContent(contentParts);
      const duration = Date.now() - startTime;
      totalTime += duration;

      const response = result.response;
      const candidates = response.candidates;

      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in response');
      }

      const parts = candidates[0].content?.parts;
      if (!parts) {
        throw new Error('No parts in response');
      }

      const imagePart = parts.find(p => p.inlineData);
      if (!imagePart || !imagePart.inlineData) {
        const textPart = parts.find(p => p.text);
        throw new Error(`No image: ${textPart?.text || 'Unknown'}`);
      }

      // Save image
      const outputPath = path.join(outputDir, `${scenario.name}.png`);
      const outputBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      fs.writeFileSync(outputPath, outputBuffer);

      console.log(`    ✅ Success in ${duration}ms`);
      console.log(`    📁 ${path.basename(outputPath)}`);

      results.push({
        scenario: scenario.name,
        success: true,
        timeMs: duration,
        outputFile: outputPath,
      });

      // Wait between requests to avoid rate limits
      if (i < TEST_SCENARIOS.length - 1) {
        console.log('    ⏳ Waiting 3s to avoid rate limits...');
        await new Promise(r => setTimeout(r, 3000));
      }

    } catch (error) {
      console.log(`    ❌ Failed: ${error.message}`);
      results.push({
        scenario: scenario.name,
        success: false,
        error: error.message,
      });
    }
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`\nResults: ${successCount} passed, ${failCount} failed`);
  console.log(`Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
  console.log(`Average: ${Math.round(totalTime / successCount)}ms per image`);

  console.log('\nDetailed Results:');
  for (const result of results) {
    const status = result.success ? '✅' : '❌';
    console.log(`  ${status} ${result.scenario}`);
    if (result.success) {
      console.log(`     Time: ${result.timeMs}ms`);
    } else {
      console.log(`     Error: ${result.error}`);
    }
  }

  // Save results JSON
  const resultsFile = path.join(outputDir, 'test-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    model: 'gemini-2.5-flash-image',
    summary: { successCount, failCount, totalTimeMs: totalTime },
    results,
  }, null, 2));

  console.log(`\n📄 Results saved to: ${resultsFile}`);
  console.log(`📁 Images saved to: ${outputDir}`);

  // Evaluation guide
  console.log(`
${'='.repeat(60)}
📋 MANUAL EVALUATION CHECKLIST
${'='.repeat(60)}

After reviewing the images in ${outputDir}, evaluate:

1. CHARACTER CONSISTENCY
   [ ] Connor's face looks similar across all images
   [ ] Carter's face looks similar across all images
   [ ] Skin tones match reference photos
   [ ] Hair color/style matches references

2. CLOTHING CONSISTENCY
   [ ] Connor wears red t-shirt and blue jeans consistently
   [ ] Carter wears green hoodie and black pants consistently

3. HUMAN-ANIMAL SEPARATION
   [ ] In dog scene: Connor is clearly human, dog is clearly dog
   [ ] In zoo scene: Connor and Carter are clearly human, lion is separate
   [ ] No hybrid/merged creatures

4. ART STYLE
   [ ] Consistent children's book illustration style
   [ ] Colors are vibrant and appealing

DECISION:
[ ] PASS - Ready to integrate Gemini as primary provider
[ ] PARTIAL - Use Gemini for specific scenarios only
[ ] FAIL - Stay with current FLUX LoRA
`);

  // Open output folder
  console.log('\n🖼️  Opening output folder...');
  exec(`open "${outputDir}"`, (err) => {
    if (err) console.log('   Could not auto-open folder.');
  });

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
