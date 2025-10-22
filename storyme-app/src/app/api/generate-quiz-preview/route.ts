/**
 * API Route: Generate Quiz Preview (No Audio, No Database)
 * Generates quiz questions for preview in the save modal
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      script,
      readingLevel = 5,
      storyTone = 'playful',
      difficulty = 'easy',
      questionCount = 3,
      characterNames = [],
    } = body;

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Story script is required' },
        { status: 400 }
      );
    }

    console.log(`🧠 Generating ${questionCount} ${difficulty} quiz questions...`);

    // Build AI prompt
    const difficultyDescriptions = {
      easy: 'very simple, suitable for ages 4-6. Focus on basic story events and main characters.',
      medium: 'moderately challenging, suitable for ages 7-9. Include some inference and sequence questions.',
      hard: 'more complex, suitable for ages 10-12. Include vocabulary, theme, and cause-effect questions.',
    };

    const prompt = `You are a children's story comprehension quiz generator. Based on the following story, create ${questionCount} multiple-choice questions at ${difficulty} difficulty level.

Story:
${script}

Requirements:
- ${questionCount} questions total (no more, no less)
- Difficulty: ${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions]}
- Each question should have 1 correct answer and 3 wrong answers
- Questions should test story comprehension (characters, events, settings, emotions)
- Use simple language appropriate for the target age group
- Wrong answers should be plausible but clearly incorrect
- Include a brief, encouraging explanation for the correct answer

Characters in this story: ${characterNames.join(', ') || 'Various characters'}
Reading Level: Age ${readingLevel}
Story Tone: ${storyTone}

Format your response as JSON array of questions:
[
  {
    "question": "What did [character] do when...?",
    "option_a": "First answer",
    "option_b": "Second answer",
    "option_c": "Third answer",
    "option_d": "Fourth answer",
    "correct_answer": "A",
    "explanation": "Brief explanation of why this is correct"
  }
]

IMPORTANT:
- Return ONLY valid JSON (no markdown, no code blocks)
- Exactly ${questionCount} questions
- correct_answer must be "A", "B", "C", or "D"`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that generates children\'s story quizzes in valid JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();

    if (!responseText) {
      throw new Error('No response from AI');
    }

    console.log('📝 AI Response:', responseText.substring(0, 200) + '...');

    // Parse JSON response
    let questions: any[];
    try {
      // Remove markdown code blocks if present
      let cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      questions = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', responseText);
      throw new Error('AI returned invalid JSON format');
    }

    // Validate questions
    if (!Array.isArray(questions) || questions.length !== questionCount) {
      throw new Error(`Expected ${questionCount} questions, got ${questions.length}`);
    }

    // Validate each question structure
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.option_a || !q.option_b || !q.option_c || !q.option_d || !q.correct_answer) {
        throw new Error(`Question ${i + 1} is missing required fields`);
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correct_answer)) {
        throw new Error(`Question ${i + 1} has invalid correct_answer: ${q.correct_answer}`);
      }
    }

    console.log(`✅ Generated ${questions.length} quiz questions successfully`);

    return NextResponse.json({
      success: true,
      questions,
      metadata: {
        difficulty,
        questionCount,
        readingLevel,
        storyTone,
      },
    });

  } catch (error: any) {
    console.error('Quiz generation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        details: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
