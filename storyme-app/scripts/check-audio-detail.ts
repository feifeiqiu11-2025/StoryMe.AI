import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAudio() {
  const projectId = 'c579ee62-b5c2-40a6-93cd-f7f05f129ee0';

  const { data: pages, error } = await supabase
    .from('story_audio_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('page_number', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📋 All Audio Pages (showing URL fields):\n');
  pages?.forEach(page => {
    console.log(`Page ${page.page_number} (${page.page_type}):`);
    console.log(`  Language: ${page.language}`);
    console.log(`  Source: ${page.audio_source}`);
    console.log(`  audio_url: ${page.audio_url ? 'EXISTS' : 'NULL'}`);
    console.log(`  audio_url_zh: ${page.audio_url_zh ? 'EXISTS' : 'NULL'}`);
    console.log('');
  });
}

checkAudio().catch(console.error);
