import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resetUserAudio() {
  const projectId = 'c579ee62-b5c2-40a6-93cd-f7f05f129ee0';

  console.log('🗑️  Deleting user-recorded audio for pages 1-2\n');

  const { data: deleted, error } = await supabase
    .from('story_audio_pages')
    .delete()
    .eq('project_id', projectId)
    .eq('audio_source', 'user_recorded')
    .select();

  if (error) {
    console.error('❌ Error deleting audio:', error);
    return;
  }

  console.log(`✅ Deleted ${deleted?.length || 0} user-recorded pages`);
  deleted?.forEach(page => {
    console.log(`  - Page ${page.page_number} (${page.page_type}): ${page.language}`);
  });

  console.log('\n✅ Ready to re-record with the fixed code!');
  console.log('The English AI TTS audio should now be restored for all pages.');
}

resetUserAudio().catch(console.error);
