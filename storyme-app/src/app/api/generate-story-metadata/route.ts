/**
 * Generate Story Metadata API
 * Uses OpenAI to generate a compelling title and description for a story
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getModelForLanguage, logModelUsage } from '@/lib/ai/deepseek-client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { script, readingLevel, storyTone, characterNames, language = 'en' } = await request.json();

    if (!script) {
      return NextResponse.json(
        { error: 'Story script is required' },
        { status: 400 }
      );
    }

    console.log(`🎨 Generating story metadata with AI (language: ${language})...`);

    // Get appropriate AI model for language
    const { client, model } = getModelForLanguage(language as 'en' | 'zh');

    // Build the prompt based on language
    const prompt = language === 'zh'
      ? `你是一位富有创意的儿童图书编辑。根据以下故事，生成一个吸引人的、适合年龄的标题和简短描述。

故事详情：
- 阅读年龄：${readingLevel || 5} 岁
- 故事基调：${storyTone || 'playful'}
- 角色：${characterNames?.join('、') || '未知'}

故事脚本：
${script}

请生成：
1. 一个吸引人、令人难忘的标题（3-8个字）来捕捉故事的精髓
2. 一个简短、引人入胜的描述（1-2句话，20-40个字）来吸引家长或孩子阅读这个故事

重要事项：
- 标题要令人兴奋，适合${readingLevel}岁的孩子
- 描述应突出主要冒险或主题
- 保持简单有趣
- 标题和描述中不要使用引号

仅以这种确切格式的JSON对象响应：
{"title": "建议的标题", "description": "简短的描述"}`
      : `You are a creative children's book editor. Based on the following story, generate a catchy, age-appropriate title and a brief description.

Story Details:
- Reading Age: ${readingLevel || 5} years old
- Story Tone: ${storyTone || 'playful'}
- Characters: ${characterNames?.join(', ') || 'Unknown'}

Story Script:
${script}

Please generate:
1. A catchy, memorable title (3-8 words) that captures the essence of the story
2. A brief, engaging description (1-2 sentences, 20-40 words) that would entice a parent or child to read the story

Important:
- Make the title exciting and age-appropriate for ${readingLevel}-year-olds
- The description should highlight the main adventure or theme
- Keep it simple and fun
- Do NOT use quotation marks in the title or description

Respond with ONLY a JSON object in this exact format:
{"title": "The proposed title", "description": "The brief description"}`;

    const systemMessage = language === 'zh'
      ? '你是一位富有创意的儿童图书编辑，生成吸引人的标题和描述。始终只返回有效的JSON。'
      : 'You are a creative children\'s book editor who generates catchy titles and descriptions. Always respond with valid JSON only.';

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
      response_format: { type: 'json_object' },
      max_tokens: 500,
      temperature: 0.8,
    });

    const responseText = completion.choices[0].message.content || '';
    console.log('Raw AI response:', responseText);

    // Log model usage
    logModelUsage(language as 'en' | 'zh', model, completion.usage);

    // Parse the JSON response
    let metadata;
    try {
      metadata = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback: extract title and description manually
      const titleMatch = responseText.match(/"title":\s*"([^"]+)"/);
      const descMatch = responseText.match(/"description":\s*"([^"]+)"/);

      metadata = {
        title: titleMatch ? titleMatch[1] : 'My Amazing Story',
        description: descMatch ? descMatch[1] : 'A wonderful adventure awaits!',
      };
    }

    console.log('✅ Generated metadata:', metadata);

    return NextResponse.json({
      title: metadata.title || 'My Amazing Story',
      description: metadata.description || 'A wonderful adventure awaits!',
    });

  } catch (error) {
    console.error('Error generating story metadata:', error);

    // Return fallback values instead of error
    return NextResponse.json({
      title: 'My Amazing Story',
      description: 'A wonderful adventure full of fun and excitement!',
      warning: 'AI generation failed, using default values',
    });
  }
}
