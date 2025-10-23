/**
 * Quiz Generation API
 * POST - Generate quiz questions with AI + auto-generate TTS audio
 * GET - Fetch existing quiz questions
 * PUT - Update/edit quiz questions
 * DELETE - Delete quiz questions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export const maxDuration = 300; // 5 minutes for quiz + audio generation

// Voice configuration - same as story audio
const VOICE_CONFIG: Record<string, { voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer', speed: number }> = {
  playful: { voice: 'nova', speed: 0.85 },
  educational: { voice: 'nova', speed: 0.80 },
  adventurous: { voice: 'nova', speed: 0.85 },
  adventure: { voice: 'nova', speed: 0.85 },
  calming: { voice: 'shimmer', speed: 0.75 },
  gentle: { voice: 'shimmer', speed: 0.75 },
  mysterious: { voice: 'shimmer', speed: 0.80 },
  mystery: { voice: 'shimmer', speed: 0.80 },
  silly: { voice: 'nova', speed: 0.90 },
  brave: { voice: 'nova', speed: 0.85 },
  friendly: { voice: 'nova', speed: 0.85 },
  default: { voice: 'nova', speed: 0.85 },
};

interface QuizQuestion {
  question_order: number;
  question_text: string;
  correct_answer: string;
  wrong_answer_1: string;
  wrong_answer_2: string;
  wrong_answer_3?: string;
  explanation?: string;
}

/**
 * POST - Generate quiz questions with AI + audio
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch project with scenes
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        scenes (
          id,
          scene_number,
          description,
          caption
        )
      `)
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // 3. Build story content for AI
    const scenes = (project.scenes || []).sort((a: any, b: any) => a.scene_number - b.scene_number);
    const storyContent = scenes.map((scene: any) =>
      scene.caption || scene.description
    ).join('\n\n');

    if (!storyContent || storyContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'Story has no content to generate quiz questions' },
        { status: 400 }
      );
    }

    console.log(`📝 Generating quiz for project: ${projectId}`);
    console.log(`📖 Story content length: ${storyContent.length} chars`);

    // 4. Generate quiz questions with OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a children's story comprehension quiz generator. Based on the following story, create 3 simple multiple-choice questions suitable for kids aged 4-8.

Story:
${storyContent}

Requirements:
- 3 questions total
- Each question should have 1 correct answer and 3 wrong answers
- Questions should test basic story comprehension (characters, events, settings)
- Use simple language appropriate for young children
- Wrong answers should be plausible but clearly incorrect
- Include a brief, encouraging explanation for the correct answer

Format your response as JSON:
{
  "questions": [
    {
      "question_text": "What did [character] find?",
      "correct_answer": "A magic wand",
      "wrong_answer_1": "A rock",
      "wrong_answer_2": "A flower",
      "wrong_answer_3": "A book",
      "explanation": "That's right! [Character] found a magic wand in the forest!"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates educational quiz questions for children.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;
    if (!aiResponse) {
      throw new Error('No response from AI');
    }

    const parsedQuiz = JSON.parse(aiResponse);
    const questions: QuizQuestion[] = parsedQuiz.questions.map((q: any, index: number) => ({
      question_order: index + 1,
      question_text: q.question_text,
      correct_answer: q.correct_answer,
      wrong_answer_1: q.wrong_answer_1,
      wrong_answer_2: q.wrong_answer_2,
      wrong_answer_3: q.wrong_answer_3 || null,
      explanation: q.explanation || null,
    }));

    console.log(`✅ AI generated ${questions.length} questions`);

    // 5. Delete existing quiz questions
    await supabase
      .from('quiz_questions')
      .delete()
      .eq('project_id', projectId);

    // 6. Save questions to database
    const { data: savedQuestions, error: saveError } = await supabase
      .from('quiz_questions')
      .insert(
        questions.map(q => ({
          project_id: projectId,
          question_order: q.question_order,
          question_text: q.question_text,
          correct_answer: q.correct_answer,
          wrong_answer_1: q.wrong_answer_1,
          wrong_answer_2: q.wrong_answer_2,
          wrong_answer_3: q.wrong_answer_3,
          explanation: q.explanation,
          audio_generated: false,
        }))
      )
      .select();

    if (saveError || !savedQuestions) {
      console.error('Save error:', saveError);
      return NextResponse.json({ error: 'Failed to save quiz questions' }, { status: 500 });
    }

    console.log(`💾 Saved ${savedQuestions.length} questions to database`);

    // 7. Generate audio for quiz questions (if story has audio)
    const { data: storyAudio } = await supabase
      .from('story_audio_pages')
      .select('voice_id, tone')
      .eq('project_id', projectId)
      .limit(1)
      .single();

    let audioGenerated = false;

    if (storyAudio) {
      console.log(`🎤 Story has audio, generating quiz audio...`);

      const tone = storyAudio.tone || 'default';
      const voiceConfig = VOICE_CONFIG[tone] || VOICE_CONFIG.default;

      // Generate transition audio
      const transitionText = "Let's see if our little readers and listeners are paying attention!";

      try {
        const transitionMp3 = await openai.audio.speech.create({
          model: 'tts-1',
          voice: voiceConfig.voice,
          input: transitionText,
          speed: voiceConfig.speed,
        });

        const transitionBuffer = Buffer.from(await transitionMp3.arrayBuffer());
        const transitionFilename = `${projectId}/quiz-transition-${Date.now()}.mp3`;

        await supabase.storage
          .from('story-audio-files')
          .upload(transitionFilename, transitionBuffer, {
            contentType: 'audio/mpeg',
            upsert: true,
          });

        // Generate audio for each question + answers
        for (const question of savedQuestions) {
          // Question audio
          const questionMp3 = await openai.audio.speech.create({
            model: 'tts-1',
            voice: voiceConfig.voice,
            input: question.question_text,
            speed: voiceConfig.speed,
          });

          const questionBuffer = Buffer.from(await questionMp3.arrayBuffer());
          const questionFilename = `${projectId}/quiz-q${question.question_order}-question-${Date.now()}.mp3`;

          const { data: questionUpload } = await supabase.storage
            .from('story-audio-files')
            .upload(questionFilename, questionBuffer, {
              contentType: 'audio/mpeg',
              upsert: true,
            });

          const { data: { publicUrl: questionUrl } } = supabase.storage
            .from('story-audio-files')
            .getPublicUrl(questionFilename);

          // Generate audio for each answer option
          const answers = [
            { text: question.correct_answer, field: 'correct_answer' },
            { text: question.wrong_answer_1, field: 'option_a' },
            { text: question.wrong_answer_2, field: 'option_b' },
            { text: question.wrong_answer_3, field: 'option_c' },
          ].filter(a => a.text);

          const audioUrls: any = { question_audio_url: questionUrl };

          for (let i = 0; i < answers.length; i++) {
            const answer = answers[i];
            const mp3 = await openai.audio.speech.create({
              model: 'tts-1',
              voice: voiceConfig.voice,
              input: answer.text,
              speed: voiceConfig.speed,
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());
            const filename = `${projectId}/quiz-q${question.question_order}-answer${i}-${Date.now()}.mp3`;

            await supabase.storage
              .from('story-audio-files')
              .upload(filename, buffer, {
                contentType: 'audio/mpeg',
                upsert: true,
              });

            const { data: { publicUrl } } = supabase.storage
              .from('story-audio-files')
              .getPublicUrl(filename);

            audioUrls[`option_${String.fromCharCode(97 + i)}_audio_url`] = publicUrl;
          }

          // Update question with audio URLs
          await supabase
            .from('quiz_questions')
            .update({
              ...audioUrls,
              audio_generated: true,
            })
            .eq('id', question.id);

          console.log(`🎵 Generated audio for question ${question.question_order}`);
        }

        audioGenerated = true;
        console.log(`✅ Quiz audio generation complete`);
      } catch (audioError) {
        console.error('Audio generation error:', audioError);
        // Continue without audio - quiz still works
      }
    } else {
      console.log(`ℹ️ Story has no audio, skipping quiz audio generation`);
    }

    return NextResponse.json({
      success: true,
      message: audioGenerated
        ? 'Quiz generated with audio successfully!'
        : 'Quiz generated successfully (no audio - story has no audio)',
      questions: savedQuestions,
      audioGenerated,
    });

  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quiz', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET - Fetch existing quiz questions (PUBLIC - no auth required for kids app)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Public endpoint - no auth check required
    // Kids app needs to fetch quiz for published stories

    const { data: questions, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('project_id', projectId)
      .order('question_order', { ascending: true });

    if (error) {
      const response = NextResponse.json({ error: error.message }, { status: 500 });
      // Add CORS headers for kids app
      response.headers.set('Access-Control-Allow-Origin', '*');
      response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return response;
    }

    const response = NextResponse.json({
      exists: questions && questions.length > 0,
      questions: questions || [],
      hasAudio: questions?.some(q => q.audio_generated) || false,
    });

    // Add CORS headers for kids app
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;

  } catch (error: any) {
    console.error('Fetch quiz error:', error);
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    // Add CORS headers even for errors
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return response;
  }
}

/**
 * OPTIONS - Handle preflight requests for CORS
 */
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Max-Age', '86400');
  return response;
}

/**
 * DELETE - Delete quiz questions
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Verify ownership
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Delete questions (cascade will handle attempts)
    const { error } = await supabase
      .from('quiz_questions')
      .delete()
      .eq('project_id', projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Quiz deleted' });

  } catch (error: any) {
    console.error('Delete quiz error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
