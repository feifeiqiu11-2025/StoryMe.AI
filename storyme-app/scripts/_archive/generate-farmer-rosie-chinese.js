const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Read .env.local file manually
const envPath = path.join(__dirname, '.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1].trim()] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;
const deepseekApiKey = envVars.DEEPSEEK_API_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const deepseek = new OpenAI({
  apiKey: deepseekApiKey,
  baseURL: 'https://api.deepseek.com'
});

/**
 * Translate English caption to Chinese with name replacements
 */
async function translateCaption(englishCaption) {
  const translationPrompt = `Translate the following English children's story caption to Chinese. Keep the same playful, age-appropriate tone.

IMPORTANT NAME TRANSLATIONS:
- Connor → 康浩
- Carter → 康乐
- Rosie → 若曦
- Farmer Rosie → 农场主若曦
- KindleWood → KindleWood (keep as English)

English Caption:
${englishCaption}

Chinese Translation:`;

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 500,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content: '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。请注意：Connor 翻译为"康浩"，Carter 翻译为"康乐"，Rosie 翻译为"若曦"，Farmer Rosie 翻译为"农场主若曦"，KindleWood 保持英文不翻译。'
      },
      {
        role: 'user',
        content: translationPrompt
      }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

/**
 * Ask user for confirmation
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

/**
 * Generate Chinese captions for "Farmer Rosie" story
 */
async function generateFarmerRosieChinese() {
  const projectId = 'a7f5c9ea-033b-48b6-9a8b-667deaaaee12'; // Farmer Rosie story ID

  console.log('\n🚀 Starting Chinese caption generation for "Farmer Rosie" story...\n');

  // Get the story with all scenes
  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, scenes(*)')
    .eq('id', projectId)
    .single();

  if (error || !project) {
    console.error('❌ Error fetching Farmer Rosie story:', error);
    return;
  }

  console.log(`📖 Story: "${project.title}"`);
  console.log(`   Total scenes: ${project.scenes.length}\n`);

  // Sort scenes by scene_number
  const sortedScenes = project.scenes.sort((a, b) => a.scene_number - b.scene_number);

  // Get all scenes with captions (regenerate even if Chinese caption exists)
  const scenesToTranslate = sortedScenes.filter(s => s.caption);

  if (scenesToTranslate.length === 0) {
    console.log('✅ All scenes already have Chinese captions');
    return;
  }

  console.log(`🔄 Translating ${scenesToTranslate.length} scenes...\n`);

  const translations = [];

  // Translate each scene
  for (const scene of scenesToTranslate) {
    try {
      console.log(`Scene ${scene.scene_number}: Translating...`);

      const chineseCaption = await translateCaption(scene.caption);

      translations.push({
        sceneId: scene.id,
        sceneNumber: scene.scene_number,
        english: scene.caption,
        chinese: chineseCaption
      });

      console.log(`✅ Done\n`);

      // Rate limiting: wait 500ms between requests
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.error(`❌ Error translating scene ${scene.scene_number}:`, error.message);
    }
  }

  // Display all translations side by side
  console.log('\n' + '='.repeat(100));
  console.log('📊 TRANSLATION REVIEW - "Farmer Rosie" Story');
  console.log('='.repeat(100) + '\n');

  translations.forEach(t => {
    console.log(`Scene ${t.sceneNumber}:`);
    console.log(`  🇺🇸 English: ${t.english}`);
    console.log(`  🇨🇳 Chinese: ${t.chinese}`);
    console.log('');
  });

  console.log('='.repeat(100) + '\n');

  // Ask for confirmation
  const answer = await askQuestion('Do you want to save these translations to the database? (yes/no): ');

  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    console.log('\n💾 Saving translations to database...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const t of translations) {
      const { error } = await supabase
        .from('scenes')
        .update({ caption_chinese: t.chinese })
        .eq('id', t.sceneId);

      if (error) {
        console.error(`❌ Error saving scene ${t.sceneNumber}:`, error);
        errorCount++;
      } else {
        console.log(`✅ Saved scene ${t.sceneNumber}`);
        successCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Successfully saved: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`\n✨ Once saved to DB, PDF export will automatically show both English and Chinese captions!`);

  } else {
    console.log('\n❌ Cancelled. No translations were saved to the database.');
  }
}

generateFarmerRosieChinese();
