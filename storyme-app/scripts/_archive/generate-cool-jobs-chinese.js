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

/**
 * Translate English caption to Chinese with name replacements
 */
async function translateCaption(englishCaption) {
  const translationPrompt = `Translate the following English children's story caption to Chinese. Keep the same playful, age-appropriate tone.

IMPORTANT NAME TRANSLATIONS:
- Connor → 康浩
- Carter → 康乐
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
        content: '你是专业的儿童故事翻译专家，擅长将英文故事翻译成生动、适合儿童的中文。请注意：Connor 翻译为"康浩"，Carter 翻译为"康乐"，KindleWood 保持英文不翻译。'
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
 * Generate Chinese captions for Cool Jobs stories
 */
async function generateCoolJobsChinese() {
  // Find the "Cool Jobs" tag
  const { data: tags } = await supabase
    .from('story_tags')
    .select('id')
    .eq('name', 'Cool Jobs')
    .single();

  if (!tags) {
    console.log('❌ Cool Jobs tag not found');
    return;
  }

  // Find all projects with this tag
  const { data: projectTags } = await supabase
    .from('project_tags')
    .select('project_id')
    .eq('tag_id', tags.id);

  console.log(`\n🚀 Starting Chinese caption generation for ${projectTags.length} Cool Jobs stories...\n`);

  let totalScenes = 0;
  let successCount = 0;
  let errorCount = 0;

  // Process each story
  for (const pt of projectTags) {
    const { data: project } = await supabase
      .from('projects')
      .select('id, title, scenes(*)')
      .eq('id', pt.project_id)
      .single();

    if (!project) continue;

    console.log(`\n📖 Processing: "${project.title}"`);
    console.log(`   Scenes: ${project.scenes.length}`);

    // Get scenes without Chinese captions
    const scenesToTranslate = project.scenes.filter(s => !s.caption_chinese && s.caption);

    if (scenesToTranslate.length === 0) {
      console.log(`   ✅ All scenes already have Chinese captions`);
      continue;
    }

    console.log(`   🔄 Translating ${scenesToTranslate.length} scenes...`);

    // Translate each scene
    for (const scene of scenesToTranslate) {
      totalScenes++;
      try {
        console.log(`      Scene ${scene.scene_number}: Translating...`);

        const chineseCaption = await translateCaption(scene.caption);

        // Update scene with Chinese caption
        const { error } = await supabase
          .from('scenes')
          .update({ caption_chinese: chineseCaption })
          .eq('id', scene.id);

        if (error) {
          console.error(`      ❌ Error updating scene ${scene.scene_number}:`, error);
          errorCount++;
        } else {
          console.log(`      ✅ Scene ${scene.scene_number}: "${chineseCaption}"`);
          successCount++;
        }

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`      ❌ Error translating scene ${scene.scene_number}:`, error.message);
        errorCount++;
      }
    }
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   Total scenes processed: ${totalScenes}`);
  console.log(`   ✅ Successfully translated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

generateCoolJobsChinese();
