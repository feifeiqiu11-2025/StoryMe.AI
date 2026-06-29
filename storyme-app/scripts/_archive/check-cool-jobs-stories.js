const { createClient } = require('@supabase/supabase-js');
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
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkCoolJobsStories() {
  // First, find the tag ID for "Cool Jobs"
  const { data: tags, error: tagError } = await supabase
    .from('story_tags')
    .select('*')
    .eq('name', 'Cool Jobs');

  if (tagError) {
    console.error('Error fetching tags:', tagError);
    return;
  }

  console.log('🏷️  Tag search results:', tags);

  if (!tags || tags.length === 0) {
    console.log('❌ No "Cool Jobs" tag found');
    return;
  }

  const coolJobsTagId = tags[0].id;
  console.log(`✅ Found "Cool Jobs" tag: ${coolJobsTagId}`);

  // Find all projects with this tag
  const { data: projectTags, error: ptError } = await supabase
    .from('project_tags')
    .select('project_id')
    .eq('tag_id', coolJobsTagId);

  if (ptError) {
    console.error('Error fetching project tags:', ptError);
    return;
  }

  console.log(`\n📊 Found ${projectTags.length} stories with "Cool Jobs" tag`);

  // Get project details with scenes
  for (const pt of projectTags) {
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('id, title, scenes(*)')
      .eq('id', pt.project_id)
      .single();

    if (projError) {
      console.error(`Error fetching project ${pt.project_id}:`, projError);
      continue;
    }

    const scenesWithoutChinese = project.scenes.filter(s => !s.caption_chinese);
    const totalScenes = project.scenes.length;
    const withChinese = totalScenes - scenesWithoutChinese.length;

    console.log(`\n📖 Story: "${project.title}"`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Total scenes: ${totalScenes}`);
    console.log(`   Scenes WITHOUT Chinese captions: ${scenesWithoutChinese.length}`);
    console.log(`   Scenes WITH Chinese captions: ${withChinese}`);
  }
}

checkCoolJobsStories();
