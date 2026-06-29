import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAudio() {
  const projectId = 'e87e6674-4b16-4679-9ec5-02851cc609a3';

  // Get project
  const { data: project } = await supabase
    .from('projects')
    .select('title, story_tone, author_name, author_age')
    .eq('id', projectId)
    .single();

  // Get scenes
  const { data: scenes } = await supabase
    .from('scenes')
    .select('id, scene_number, caption, description')
    .eq('project_id', projectId)
    .order('scene_number');

  if (!scenes?.length) {
    console.log('No scenes found');
    return;
  }

  const voiceConfig = { voice: 'nova' as const, speed: 0.90 }; // silly tone

  // Generate cover page
  const coverText = project?.author_name && project?.author_age
    ? `${project.title}, by ${project.author_name}, age ${project.author_age}`
    : project?.author_name
    ? `${project.title}, by ${project.author_name}`
    : project?.title || 'Story';

  const pages = [
    { pageNumber: 1, pageType: 'cover', textContent: coverText, sceneId: null },
    ...scenes.map((s: any, i: number) => ({
      pageNumber: i + 2,
      pageType: 'scene',
      textContent: s.caption || s.description,
      sceneId: s.id
    }))
  ];

  console.log(`Generating audio for ${pages.length} pages...`);

  for (const page of pages) {
    console.log(`Page ${page.pageNumber}: ${page.textContent.substring(0, 40)}...`);

    // Generate TTS
    const mp3Response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voiceConfig.voice,
      input: page.textContent,
      speed: voiceConfig.speed,
    });

    const buffer = Buffer.from(await mp3Response.arrayBuffer());

    // Upload to storage
    const filename = `${projectId}/page-${page.pageNumber}-en-${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from('story-audio-files')
      .upload(filename, buffer, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      console.log('Upload error:', uploadError);
      continue;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('story-audio-files')
      .getPublicUrl(filename);

    // Insert audio page record - use upsert to bypass constraints
    const { error: insertError } = await supabase
      .from('story_audio_pages')
      .upsert({
        project_id: projectId,
        page_number: page.pageNumber,
        page_type: page.pageType,
        scene_id: page.sceneId,
        text_content: page.textContent,
        audio_url: publicUrl,
        audio_filename: filename,
        voice_id: voiceConfig.voice,
        tone: 'silly',
        generation_status: 'completed',
        language: 'en',
      }, { onConflict: 'project_id,page_number' });

    if (insertError) {
      console.log('Insert error:', insertError);
    } else {
      console.log('  ✅ Done!');
    }
  }

  console.log('\n🎉 Audio generation complete!');
}

generateAudio().catch(console.error);
