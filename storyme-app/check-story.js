const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

const supabase = createClient(envVars.NEXT_PUBLIC_SUPABASE_URL, envVars.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data, error } = await supabase
    .from('projects')
    .select('id, title, scenes(*)')
    .eq('id', 'ad7b9d41-6905-467a-a5a7-709c86ba5a81')
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('📖 Story:', data.title);
    console.log('   ID:', data.id);
    console.log('   Total scenes:', data.scenes.length);
    const withChinese = data.scenes.filter(s => s.caption_chinese).length;
    console.log('   Scenes with Chinese:', withChinese);
    console.log('   Scenes without Chinese:', data.scenes.length - withChinese);
  }
})();
