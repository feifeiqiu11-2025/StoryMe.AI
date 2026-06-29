const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

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

// Remaining stories to translate
const stories = [
  { id: 'eb9565a0-1372-45cf-9f15-2ac88bdba67f', name: 'Learn about Hospital', names: {} },
  { id: 'e1f4357d-38d2-40b2-99f7-823aa758169f', name: 'Learn about Airport', names: {} },
  { id: '590a68fc-411e-4461-88e2-f03744eb18de', name: 'Our Awesome Chef', names: {} },
  { id: 'beeb931a-2095-4f4a-b4fa-0b3feb37b50c', name: 'Captain Skyla', names: { 'Skyla': '思凯拉', 'Captain Skyla': '机长思凯拉' } },
  { id: '3d20f482-93bf-414a-935b-4baab1f974b8', name: 'Follow Connor to build his forever home', names: {} }
];

async function translateCaption(englishCaption, customNames = {}) {
  const nameTranslations = Object.keys(customNames).length > 0
    ? Object.entries(customNames).map(([en, zh]) => `- ${en} → ${zh}`).join('\n')
    : '';

  const translationPrompt = `Translate the following English children's story caption to Chinese. Keep the same playful, age-appropriate tone.

IMPORTANT NAME TRANSLATIONS:
- Connor → 康浩
- Carter → 康乐
${nameTranslations}
- KindleWood → KindleWood (keep as English)

English Caption:
${englishCaption}

Chinese Translation:`;

  const systemContent = customNames && Object.keys(customNames).length > 0
    ? `你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。请注意：Connor 翻译为"康浩"，Carter 翻译为"康乐"，${Object.entries(customNames).map(([en, zh]) => `${en} 翻译为"${zh}"`).join('，')}，KindleWood 保持英文不翻译。`
    : '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。请注意：Connor 翻译为"康浩"，Carter 翻译为"康乐"，KindleWood 保持英文不翻译。';

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    max_tokens: 500,
    temperature: 0.5,
    messages: [
      {
        role: 'system',
        content: systemContent
      },
      {
        role: 'user',
        content: translationPrompt
      }
    ]
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}

async function processStory(story) {
  console.log(`\n${'='.repeat(100)}`);
  console.log(`🚀 Starting: "${story.name}"`);
  console.log('='.repeat(100));

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, scenes(*)')
    .eq('id', story.id)
    .single();

  if (error || !project) {
    console.error(`❌ Error fetching ${story.name}:`, error);
    return { name: story.name, success: 0, errors: 0 };
  }

  const sortedScenes = project.scenes.sort((a, b) => a.scene_number - b.scene_number);
  const scenesToTranslate = sortedScenes.filter(s => !s.caption_chinese && s.caption);

  if (scenesToTranslate.length === 0) {
    console.log('✅ All scenes already have Chinese captions\n');
    return { name: story.name, success: 0, errors: 0, skipped: true };
  }

  console.log(`📖 Total scenes: ${project.scenes.length}`);
  console.log(`🔄 Translating ${scenesToTranslate.length} scenes...\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const scene of scenesToTranslate) {
    try {
      console.log(`  Scene ${scene.scene_number}: Translating...`);
      const chineseCaption = await translateCaption(scene.caption, story.names);

      const { error: updateError } = await supabase
        .from('scenes')
        .update({ caption_chinese: chineseCaption })
        .eq('id', scene.id);

      if (updateError) {
        console.error(`  ❌ Error saving scene ${scene.scene_number}`);
        errorCount++;
      } else {
        console.log(`  ✅ Saved scene ${scene.scene_number}`);
        successCount++;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  ❌ Error on scene ${scene.scene_number}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ "${story.name}" completed: ${successCount} saved, ${errorCount} errors\n`);
  return { name: story.name, success: successCount, errors: errorCount };
}

async function generateAllRemaining() {
  console.log('\n🌟 GENERATING CHINESE CAPTIONS FOR ALL REMAINING COOL JOBS STORIES 🌟\n');

  const results = [];

  for (const story of stories) {
    const result = await processStory(story);
    results.push(result);
  }

  console.log('\n' + '='.repeat(100));
  console.log('📊 FINAL SUMMARY - ALL STORIES');
  console.log('='.repeat(100) + '\n');

  let totalSuccess = 0;
  let totalErrors = 0;

  results.forEach(r => {
    if (r.skipped) {
      console.log(`✅ ${r.name}: Already completed`);
    } else {
      console.log(`📖 ${r.name}: ${r.success} scenes translated, ${r.errors} errors`);
      totalSuccess += r.success;
      totalErrors += r.errors;
    }
  });

  console.log(`\n🎉 TOTAL: ${totalSuccess} scenes successfully translated!`);
  if (totalErrors > 0) {
    console.log(`⚠️  Total errors: ${totalErrors}`);
  }
  console.log('\n✨ All Cool Jobs stories now have bilingual captions!\n');
}

generateAllRemaining();
