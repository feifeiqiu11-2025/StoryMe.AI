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

async function verifyChineseCaption() {
  const projectId = 'ff4ea535-e2be-499e-b1b4-27863c4c5ae1';
  
  const { data: scenes, error } = await supabase
    .from('scenes')
    .select('scene_number, caption, caption_chinese')
    .eq('project_id', projectId);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('✅ Database verification:');
  scenes.forEach(scene => {
    console.log(`Scene ${scene.scene_number}:`);
    console.log(`  English: ${scene.caption}`);
    console.log(`  Chinese: ${scene.caption_chinese}`);
    console.log(`  Has Chinese? ${!!scene.caption_chinese}`);
  });
}

verifyChineseCaption();
