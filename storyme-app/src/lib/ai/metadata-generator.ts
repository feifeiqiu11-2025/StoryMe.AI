/**
 * Story Metadata Generator
 * Reusable function to generate title and description for stories
 * Extracted from /api/generate-story-metadata for reuse in /api/enhance-scenes
 */

import { getModelForLanguage, logModelUsage } from './deepseek-client';

export interface StoryMetadataInput {
  script: string;
  readingLevel?: number;
  storyTone?: string;
  characterNames?: string[];
  language?: 'en' | 'zh';
}

export interface StoryMetadata {
  title: string;
  description: string;
}

/**
 * Generate story title and description using AI
 * @param input - Story context for metadata generation
 * @returns Promise with title and description
 */
export async function generateStoryMetadata(
  input: StoryMetadataInput
): Promise<StoryMetadata> {
  const {
    script,
    readingLevel = 5,
    storyTone = 'playful',
    characterNames = [],
    language = 'en'
  } = input;

  if (!script || !script.trim()) {
    throw new Error('Story script is required for metadata generation');
  }

  console.log(`🎨 Generating story metadata with AI (language: ${language})...`);

  // Get appropriate AI model for language
  const { client, model } = getModelForLanguage(language);

  // Build the prompt based on language
  const prompt = language === 'zh'
    ? `你是一位富有创意的儿童图书编辑。根据以下故事，生成一个吸引人的、适合年龄的标题和简短描述。

故事详情：
- 阅读年龄：${readingLevel} 岁
- 故事基调：${storyTone}
- 角色：${characterNames.join('、') || '未知'}

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
- Reading Age: ${readingLevel} years old
- Story Tone: ${storyTone}
- Characters: ${characterNames.join(', ') || 'Unknown'}

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
  logModelUsage(language, model, completion.usage);

  // Parse the JSON response
  let metadata: StoryMetadata;
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

  return {
    title: metadata.title || 'My Amazing Story',
    description: metadata.description || 'A wonderful adventure awaits!',
  };
}
