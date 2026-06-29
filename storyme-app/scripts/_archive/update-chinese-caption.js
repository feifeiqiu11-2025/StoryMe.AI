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
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    envVars[match[1].trim()] = value;
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'set' : 'missing');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'set' : 'missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateChineseCaption() {
  const projectId = 'ff4ea535-e2be-499e-b1b4-27863c4c5ae1';
  
  // Get the scene
  const { data: scenes, error } = await supabase
    .from('scenes')
    .select('*')
    .eq('project_id', projectId);
  
  if (error) {
    console.error('Error fetching scenes:', error);
    return;
  }
  
  console.log('Scenes:', scenes);
  
  // Update with Chinese translation
  const chineseCaption = '康纳开心地漂浮在太空中，周围星星闪烁，背景中可以看到发光的地球。';
  
  for (const scene of scenes) {
    const { error: updateError } = await supabase
      .from('scenes')
      .update({ caption_chinese: chineseCaption })
      .eq('id', scene.id);
    
    if (updateError) {
      console.error('Error updating scene:', updateError);
    } else {
      console.log(`✓ Updated scene ${scene.scene_number} with Chinese caption`);
    }
  }
}

updateChineseCaption();
