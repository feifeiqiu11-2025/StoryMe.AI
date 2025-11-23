/**
 * Generate Story Audio API
 * Generates audio narration for all pages of a story using OpenAI TTS
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Maximum duration for this API route (5 minutes)
export const maxDuration = 300;

// Voice configuration based on story tone
// Using slower speeds (0.75-0.9) for better comprehension and learning
// Nova and Shimmer are the most kid-friendly voices from OpenAI
const VOICE_CONFIG: Record<string, { voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer', speed: number }> = {
  playful: { voice: 'nova', speed: 0.85 },       // Kid-friendly, clear, slightly energetic
  educational: { voice: 'nova', speed: 0.80 },   // Clear enunciation for learning
  adventurous: { voice: 'nova', speed: 0.85 },   // Exciting but not too fast
  adventure: { voice: 'nova', speed: 0.85 },     // Alias
  calming: { voice: 'shimmer', speed: 0.75 },    // Soft, very slow for bedtime
  gentle: { voice: 'shimmer', speed: 0.75 },     // Alias
  mysterious: { voice: 'shimmer', speed: 0.80 }, // Gentle and mysterious
  mystery: { voice: 'shimmer', speed: 0.80 },    // Alias
  silly: { voice: 'nova', speed: 0.90 },         // Fun but comprehensible
  brave: { voice: 'nova', speed: 0.85 },         // Confident and clear
  friendly: { voice: 'nova', speed: 0.85 },      // Warm, kid-friendly
  default: { voice: 'nova', speed: 0.85 },       // Default: Nova at 0.85x speed for learning
};

interface AudioPage {
  pageNumber: number;
  pageType: 'cover' | 'scene' | 'quiz_transition' | 'quiz_question';
  textContent: string;
  sceneId?: string;
  quizQuestionId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, language = 'en' } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Validate language parameter
    if (!['en', 'zh'].includes(language)) {
      return NextResponse.json(
        { error: 'Invalid language. Must be "en" or "zh"' },
        { status: 400 }
      );
    }

    console.log(`🎵 Starting ${language.toUpperCase()} audio generation for project: ${projectId}`);

    // Initialize Supabase client
    const supabase = await createClient();

    // Get user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch project with scenes (including Chinese captions for bilingual support)
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        scenes (
          id,
          scene_number,
          description,
          caption,
          caption_chinese
        )
      `)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      console.error('Project fetch error:', projectError);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Fetch quiz questions separately
    const { data: quizQuestionsData, error: quizError } = await supabase
      .from('quiz_questions')
      .select('id, question_order, question, option_a, option_b, option_c, option_d, correct_answer, explanation')
      .eq('project_id', projectId)
      .order('question_order', { ascending: true });

    if (quizError) {
      console.error('Quiz fetch error:', quizError);
    }

    // Attach quiz questions to project object
    project.quiz_questions = quizQuestionsData || [];

    // Prepare pages for audio generation
    const pages: AudioPage[] = [];

    // Page 1: Cover page
    // For Chinese, we keep the same cover text (title + author) as it's usually in the target language
    const coverText = project.author_name && project.author_age
      ? `${project.title}, by ${project.author_name}, age ${project.author_age}`
      : project.author_name
      ? `${project.title}, by ${project.author_name}`
      : project.title;

    pages.push({
      pageNumber: 1,
      pageType: 'cover',
      textContent: coverText,
    });

    // Pages 2+: Scene pages
    const scenes = (project.scenes || []).sort((a: any, b: any) => a.scene_number - b.scene_number);

    // Check if story has Chinese captions
    const hasBilingualContent = scenes.some((scene: any) => scene.caption_chinese);

    if (language === 'zh' && !hasBilingualContent) {
      return NextResponse.json(
        { error: 'This story does not have Chinese captions. Please add Chinese captions first.' },
        { status: 400 }
      );
    }

    scenes.forEach((scene: any, index: number) => {
      // Use Chinese caption if generating Chinese audio, fallback to English
      const textContent = language === 'zh'
        ? (scene.caption_chinese || scene.caption || scene.description || `Scene ${index + 1}`)
        : (scene.caption || scene.description || `Scene ${index + 1}`);

      if (textContent && textContent.trim()) {
        pages.push({
          pageNumber: index + 2,
          pageType: 'scene',
          textContent,
          sceneId: scene.id,
        });
      } else {
        console.warn(`⚠️ Scene ${index + 1} has no text content, skipping`);
      }
    });

    console.log(`📖 Total pages to generate: ${pages.length} (1 cover + ${pages.length - 1} scenes)`);

    // Quiz pages (if quiz exists) - Only for English for now
    // TODO: Add Chinese quiz support in future
    console.log('📊 Project quiz_questions data:', project.quiz_questions);
    const quizQuestions = (project.quiz_questions || []).sort((a: any, b: any) => a.question_order - b.question_order);
    console.log(`🧠 Quiz questions count: ${quizQuestions.length}`);

    // Only add quiz pages for English audio
    if (quizQuestions.length > 0 && language === 'en') {
      console.log(`🧠 Found ${quizQuestions.length} quiz questions, adding quiz audio pages`);

      // Add transition page
      const transitionPageNumber = pages.length + 1;
      pages.push({
        pageNumber: transitionPageNumber,
        pageType: 'quiz_transition',
        textContent: "Let's see if our little readers and listeners paid attention, answer some fun questions about the story!",
      });

      // Add quiz question pages
      quizQuestions.forEach((question: any, index: number) => {
        const questionText = `Question ${index + 1}: ${question.question}. ` +
          `A: ${question.option_a}. ` +
          `B: ${question.option_b}. ` +
          `C: ${question.option_c}. ` +
          `D: ${question.option_d}.`;

        pages.push({
          pageNumber: transitionPageNumber + 1 + index,
          pageType: 'quiz_question',
          textContent: questionText,
          quizQuestionId: question.id,
        });
      });
    }

    console.log(`📖 Generating audio for ${pages.length} pages (${scenes.length} scenes${quizQuestions.length > 0 ? ` + ${quizQuestions.length} quiz questions` : ''})`);

    // Get voice configuration based on story tone
    const tone = project.story_tone || 'default';
    const voiceConfig = VOICE_CONFIG[tone] || VOICE_CONFIG.default;
    console.log(`🎤 Using voice: ${voiceConfig.voice}, speed: ${voiceConfig.speed}`);

    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    // For English: Delete existing audio pages and recreate
    // For Chinese: Update existing rows with Chinese audio columns
    if (language === 'en') {
      await supabase
        .from('story_audio_pages')
        .delete()
        .eq('project_id', projectId);
    }

    // Generate audio for each page
    const generatedPages = [];

    for (const page of pages) {
      try {
        console.log(`🎵 Generating ${language.toUpperCase()} audio for page ${page.pageNumber}: "${page.textContent.substring(0, 50)}..."`);

        let audioPageId: string;

        if (language === 'en') {
          // English: Insert new row
          const { data: audioPage, error: insertError } = await supabase
            .from('story_audio_pages')
            .insert({
              project_id: projectId,
              page_number: page.pageNumber,
              page_type: page.pageType,
              scene_id: page.sceneId,
              quiz_question_id: page.quizQuestionId,
              text_content: page.textContent,
              voice_id: voiceConfig.voice,
              tone: tone,
              generation_status: 'generating',
              language: 'en',
            })
            .select()
            .single();

          if (insertError || !audioPage) {
            console.error(`Failed to create audio page record for page ${page.pageNumber}`);
            console.error('Insert error details:', insertError);
            continue;
          }
          audioPageId = audioPage.id;
        } else {
          // Chinese: Find existing row or create one
          const { data: existingPage } = await supabase
            .from('story_audio_pages')
            .select('id')
            .eq('project_id', projectId)
            .eq('page_number', page.pageNumber)
            .single();

          if (existingPage) {
            audioPageId = existingPage.id;
            // Update text_content_zh
            await supabase
              .from('story_audio_pages')
              .update({ text_content_zh: page.textContent })
              .eq('id', audioPageId);
          } else {
            // Create new row if English audio wasn't generated first
            const { data: newPage, error: insertError } = await supabase
              .from('story_audio_pages')
              .insert({
                project_id: projectId,
                page_number: page.pageNumber,
                page_type: page.pageType,
                scene_id: page.sceneId,
                quiz_question_id: page.quizQuestionId,
                text_content_zh: page.textContent,
                voice_id: voiceConfig.voice,
                tone: tone,
                generation_status: 'generating',
                language: 'en', // Default, but we're adding Chinese audio
              })
              .select()
              .single();

            if (insertError || !newPage) {
              console.error(`Failed to create audio page record for page ${page.pageNumber}`);
              continue;
            }
            audioPageId = newPage.id;
          }
        }

        // Generate audio with OpenAI TTS
        const mp3Response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voiceConfig.voice,
          input: page.textContent,
          speed: voiceConfig.speed,
        });

        // Convert response to buffer
        const buffer = Buffer.from(await mp3Response.arrayBuffer());

        // Upload to Supabase storage with language suffix
        const filename = `${projectId}/page-${page.pageNumber}-${language}-${Date.now()}.mp3`;
        const { error: uploadError } = await supabase.storage
          .from('story-audio-files')
          .upload(filename, buffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for page ${page.pageNumber}:`, uploadError);

          // Update status to failed
          await supabase
            .from('story_audio_pages')
            .update({
              generation_status: 'failed',
              error_message: uploadError.message,
            })
            .eq('id', audioPageId);

          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('story-audio-files')
          .getPublicUrl(filename);

        // Update audio page with URL based on language
        const updateData = language === 'en'
          ? {
              audio_url: publicUrl,
              audio_filename: filename,
              generation_status: 'completed',
            }
          : {
              audio_url_zh: publicUrl,
              generation_status: 'completed',
            };

        const { data: updatedPage } = await supabase
          .from('story_audio_pages')
          .update(updateData)
          .eq('id', audioPageId)
          .select()
          .single();

        if (updatedPage) {
          generatedPages.push(updatedPage);
          console.log(`✅ Page ${page.pageNumber} ${language.toUpperCase()} audio generated successfully`);

          // If this is a quiz question page, also update the quiz_questions table (English only)
          if (language === 'en' && page.pageType === 'quiz_question' && page.quizQuestionId) {
            await supabase
              .from('quiz_questions')
              .update({
                question_audio_url: publicUrl,
                audio_generated: true,
              })
              .eq('id', page.quizQuestionId);

            console.log(`✅ Updated quiz question ${page.quizQuestionId} with audio URL`);
          }
        }

      } catch (pageError: any) {
        console.error(`Error generating audio for page ${page.pageNumber}:`, pageError);

        // Try to update status to failed
        try {
          await supabase
            .from('story_audio_pages')
            .update({
              generation_status: 'failed',
              error_message: pageError.message || 'Unknown error',
            })
            .eq('project_id', projectId)
            .eq('page_number', page.pageNumber);
        } catch (updateError) {
          console.error('Failed to update error status:', updateError);
        }
      }
    }

    console.log(`🎉 ${language.toUpperCase()} audio generation complete. ${generatedPages.length}/${pages.length} pages successful`);

    return NextResponse.json({
      success: true,
      message: `Generated ${language.toUpperCase()} audio for ${generatedPages.length} pages`,
      language,
      totalPages: pages.length,
      successfulPages: generatedPages.length,
      audioPages: generatedPages,
    });

  } catch (error: any) {
    console.error('Audio generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate audio' },
      { status: 500 }
    );
  }
}
