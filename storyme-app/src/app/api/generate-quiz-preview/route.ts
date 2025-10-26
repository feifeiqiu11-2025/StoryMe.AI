/**
 * API Route: Generate Quiz Preview (No Audio, No Database)
 * Generates quiz questions for preview in the save modal
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getModelForLanguage, logModelUsage } from '@/lib/ai/deepseek-client';

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
      language = 'en',
    } = body;

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { error: 'Story script is required' },
        { status: 400 }
      );
    }

    console.log(`🧠 Generating ${questionCount} ${difficulty} quiz questions (language: ${language})...`);

    // Get appropriate AI model for language
    const { client, model } = getModelForLanguage(language as 'en' | 'zh');

    // Build AI prompt based on language
    const difficultyDescriptions = {
      easy: language === 'zh'
        ? '非常简单，适合4-6岁。关注基本的故事事件和主要角色。'
        : 'very simple, suitable for ages 4-6. Focus on basic story events and main characters.',
      medium: language === 'zh'
        ? '中等挑战，适合7-9岁。包括一些推理和顺序问题。'
        : 'moderately challenging, suitable for ages 7-9. Include some inference and sequence questions.',
      hard: language === 'zh'
        ? '更复杂，适合10-12岁。包括词汇、主题和因果问题。'
        : 'more complex, suitable for ages 10-12. Include vocabulary, theme, and cause-effect questions.',
    };

    const prompt = language === 'zh'
      ? `你是儿童故事理解力测验生成器。根据以下故事，创建${questionCount}个${difficulty}难度级别的选择题。

故事：
${script}

要求：
- 总共${questionCount}个问题（不多不少）
- 难度：${difficultyDescriptions[difficulty as keyof typeof difficultyDescriptions]}
- 每个问题应该有1个正确答案和3个错误答案
- 问题应该测试故事理解力（角色、事件、场景、情感）
- 使用适合目标年龄组的简单语言
- 错误答案应该看似合理但明显错误
- 为正确答案包含简短、鼓励性的解释

故事中的角色：${characterNames.join('、') || '各种角色'}
阅读水平：${readingLevel}岁
故事基调：${storyTone}

将您的回答格式化为问题的JSON数组：
[
  {
    "question": "当...时，[角色]做了什么？",
    "option_a": "第一个答案",
    "option_b": "第二个答案",
    "option_c": "第三个答案",
    "option_d": "第四个答案",
    "correct_answer": "A",
    "explanation": "简短解释为什么这是正确的"
  }
]

重要提醒：
- 只返回有效的JSON（没有markdown，没有代码块）
- 恰好${questionCount}个问题
- correct_answer必须是"A"、"B"、"C"或"D"`
      : `You are a children's story comprehension quiz generator. Based on the following story, create ${questionCount} multiple-choice questions at ${difficulty} difficulty level.

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

    const systemMessage = language === 'zh'
      ? '你是一个有用的助手，以有效的JSON格式生成儿童故事测验。'
      : 'You are a helpful assistant that generates children\'s story quizzes in valid JSON format.';

    // Call AI model
    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: systemMessage,
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

    // Log model usage
    logModelUsage(language as 'en' | 'zh', model, completion.usage);

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
