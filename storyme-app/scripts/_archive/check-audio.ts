import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAudio() {
  const projectId = 'c579ee62-b5c2-40a6-93cd-f7f05f129ee0';

  console.log('🔍 Checking audio for story:', projectId);
  console.log('');

  // Check story_audio_pages table
  const { data: audioPages, error } = await supabase
    .from('story_audio_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('page_number', { ascending: true });

  if (error) {
    console.error('❌ Error querying database:', error);
    return;
  }

  console.log('📊 Total audio pages found:', audioPages?.length || 0);
  console.log('');

  if (audioPages && audioPages.length > 0) {
    // Group by language and audio source
    const byLanguage = audioPages.reduce((acc, page) => {
      const lang = page.language || 'unknown';
      if (!acc[lang]) acc[lang] = [];
      acc[lang].push(page);
      return acc;
    }, {} as Record<string, any[]>);

    const bySource = audioPages.reduce((acc, page) => {
      const source = page.audio_source || 'unknown';
      if (!acc[source]) acc[source] = [];
      acc[source].push(page);
      return acc;
    }, {} as Record<string, any[]>);

    console.log('📝 Breakdown by language:');
    Object.entries(byLanguage).forEach(([lang, pages]) => {
      console.log(`  ${lang}: ${pages.length} pages`);
    });
    console.log('');

    console.log('🎙️ Breakdown by source:');
    Object.entries(bySource).forEach(([source, pages]) => {
      console.log(`  ${source}: ${pages.length} pages`);
    });
    console.log('');

    // Show user-recorded audio details
    const userRecorded = audioPages.filter(p => p.audio_source === 'user_recorded');
    if (userRecorded.length > 0) {
      console.log('✅ User-recorded audio found:');
      userRecorded.forEach(page => {
        console.log(`  Page ${page.page_number} (${page.page_type}): ${page.language}`);
        console.log(`    URL: ${page.audio_url}`);
        console.log(`    Voice Profile ID: ${page.voice_profile_id}`);
        console.log(`    Recorded by: ${page.recorded_by_user_id}`);
        console.log(`    Status: ${page.generation_status}`);
        console.log('');
      });
    } else {
      console.log('❌ No user-recorded audio found');
      console.log('');
      console.log('📋 All audio pages:');
      audioPages.forEach(page => {
        console.log(`  Page ${page.page_number}: ${page.audio_source} (${page.language})`);
      });
    }
  } else {
    console.log('❌ No audio pages found for this story');
  }

  // Check voice_profiles
  console.log('');
  console.log('👤 Checking voice profiles...');
  const { data: profiles } = await supabase
    .from('voice_profiles')
    .select('*');

  if (profiles && profiles.length > 0) {
    console.log(`Found ${profiles.length} voice profiles`);
  } else {
    console.log('No voice profiles found');
  }
}

checkAudio().catch(console.error);
