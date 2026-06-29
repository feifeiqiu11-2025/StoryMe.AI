import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixPages() {
  const projectId = 'c579ee62-b5c2-40a6-93cd-f7f05f129ee0';

  console.log('🔧 Fixing pages 1-2: Moving Chinese audio from audio_url to audio_url_zh\n');

  // Get pages 1-2
  const { data: pages, error: fetchError } = await supabase
    .from('story_audio_pages')
    .select('*')
    .eq('project_id', projectId)
    .in('page_number', [1, 2]);

  if (fetchError) {
    console.error('❌ Error fetching pages:', fetchError);
    return;
  }

  for (const page of pages || []) {
    if (page.language === 'zh' && page.audio_url && !page.audio_url_zh) {
      console.log(`Page ${page.page_number}: Moving Chinese audio to audio_url_zh field`);

      // Move audio_url to audio_url_zh and clear audio_url
      const { error: updateError } = await supabase
        .from('story_audio_pages')
        .update({
          audio_url_zh: page.audio_url,
          audio_filename_zh: page.audio_filename,
          audio_url: null,
          audio_filename: null,
          language: 'en', // Reset to English as primary
        })
        .eq('project_id', projectId)
        .eq('page_number', page.page_number);

      if (updateError) {
        console.error(`❌ Error updating page ${page.page_number}:`, updateError);
      } else {
        console.log(`✅ Page ${page.page_number} fixed`);
      }
    }
  }

  console.log('\n✅ Pages fixed! Chinese audio is now in audio_url_zh field.');
  console.log('Note: audio_url (English) is now null for these pages.');
  console.log('You can re-record English audio if needed, or the existing AI TTS English audio can be regenerated.');
}

fixPages().catch(console.error);
