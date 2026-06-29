import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function deleteAudio() {
  const projectId = 'c579ee62-b5c2-40a6-93cd-f7f05f129ee0';

  console.log('🗑️  Deleting user-recorded audio for story:', projectId);
  console.log('');

  // Delete the 3 user-recorded pages (pages 1, 2, 3)
  const { data: deleted, error } = await supabase
    .from('story_audio_pages')
    .delete()
    .eq('project_id', projectId)
    .eq('audio_source', 'user_recorded')
    .in('page_number', [1, 2, 3])
    .select();

  if (error) {
    console.error('❌ Error deleting audio:', error);
    return;
  }

  console.log(`✅ Deleted ${deleted?.length || 0} audio pages`);
  deleted?.forEach(page => {
    console.log(`  - Page ${page.page_number} (${page.page_type}): ${page.language}`);
  });
}

deleteAudio().catch(console.error);
